import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendAdminMail } from '../../../lib/notifyRecipients'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

// 承認済みの出店を、運営が取り消す。
//
// 出店者から「行けなくなった」と連絡が来たときに、運営が処理するための入口。
// 出店者・募集者の画面には取消しの入口を作らない（「連絡すれば消せる」と
// 分かるとキャンセルが増えるため、運営が受けて処理する形を守る）。
//
// 行は消さずに status='cancelled' にする。理由:
//   ・キャンセルポリシーに「承認後は理由・時期を問わずキャンセル料が発生」と
//     書いてあり、消すと請求の根拠が残らない
//   ・sales.application_id は ON DELETE SET NULL。消すと売上が
//     「どの出店のものか」を失い、金額だけ浮く
//
// お金の記録があるものは取り消させない。詳しくは canCancel() のコメント。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

// 二重送信の抑制（他の通知と同じ方式）
const recentSends = new Map<string, number>()

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }
    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 呼び出し元をアクセストークンで確かめる（bodyのIDは信用しない）
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

    // 運営だけが押せる。募集者にも applications の更新権限があるため、
    // RLS では絞れない。ここで確かめる。
    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: '運営のみが出店を取り消せます' }, { status: 403 })
    }

    // notify=false は「知らせずに取り消す」。
    // テストで作った出店をスケジュールから片づけるためのもので、
    // 実在の出店者・募集者に取消しの連絡が飛ぶと困る場面に使う。
    // 既定は今までどおり通知する（指定を忘れて黙って消えるのを防ぐ）
    // force=true は「当日の進行の記録（搬入〜撤収）があっても取り消す」。
    // テストで当日の進行まで押してしまった出店を片づけるためのもの。
    // お金の記録（売上報告・請求書）がある場合は force でも取り消せない
    const { applicationId, reason, notify, force } = await req.json()
    const silent = notify === false
    const forced = force === true
    if (!applicationId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

    const { data: app, error: aErr } = await db
      .from('applications')
      .select('id, seller_id, place_id, apply_date, status, confirmed_at, checked_in_at, ready_at, opened_at, closed_at, left_at, checkin_seen_at')
      .eq('id', applicationId)
      .single()
    if (aErr || !app) return NextResponse.json({ error: '申込が見つかりません' }, { status: 404 })

    if (app.status === 'cancelled') {
      return NextResponse.json({ error: 'この出店はすでに取り消されています' }, { status: 409 })
    }
    if (app.status !== 'approved') {
      return NextResponse.json(
        { error: '承認済みの出店だけを取り消せます（承認待ちは辞退の扱いです）' },
        { status: 409 },
      )
    }

    // ---- お金の記録を守る ----
    //
    // 「請求済みなのに取り消せた」が最悪の事故なので、status ではなく
    // お金の記録そのものを条件にする。
    //
    // ⑴ 売上報告がある … 実際に出店して報告まで済んでいる
    // ⑵ 当日の受付を済ませている … 実際に現場に入っている
    // ⑶ その月の請求書がある … 請求を出してしまっている
    //    （出店料0円の売上は invoices.sale_ids に入らないため、
    //      sale_ids ではなく seller_id と対象月で見る）
    const blockers: string[] = []
    // 引っかかった種類。当日の記録だけなら運営が force で取り消せる
    const kinds = new Set<'sales' | 'checkin' | 'invoice'>()
    // ⑶で見つけた請求書番号。⑷で同じ番号を二重に出さないため
    const seenInvoiceNos = new Set<string>()

    const { data: sales } = await db
      .from('sales').select('id, sale_date, revenue').eq('application_id', app.id)
    if (sales && sales.length > 0) {
      kinds.add('sales')
      blockers.push(
        `売上報告が${sales.length}件あります（${sales.map(s => s.sale_date).join('、')}）`
        + ' → 管理画面の「売上管理」でその報告を削除してから、もう一度お試しください',
      )
    }

    // 当日の進行（搬入・営業準備・営業開始・営業終了・撤収）を出店者が押した記録。
    // 実際に現場に入った証拠なので、ふだんは止める。
    // ただしお金の記録が無く、運営が「テストの片づけ」と判断したときは force で通す。
    //
    // checked_in_at（搬入）だけを見ると取りこぼす。出店者は押した工程を
    // もう一度押して取り消せるので、「搬入だけ取り消して、撤収の記録は残っている」
    // という状態が普通に作れる（app/api/onsite/route.ts の undo は1列ずつ）
    const ONSITE_COLUMNS = ['confirmed_at', 'checked_in_at', 'ready_at', 'opened_at', 'closed_at', 'left_at'] as const
    const hasOnsite = ONSITE_COLUMNS.some(c => (app as Record<string, unknown>)[c])
    if (hasOnsite && !forced) {
      kinds.add('checkin')
      blockers.push(
        '当日の進行（車両の搬入〜撤収）が記録されています。実際に出店されたものは取り消さないでください'
        + ' → テストで押しただけなら、出店管理（スケジュール）からこの出店を開くと、記録ごと取り消せます',
      )
    }

    if (app.apply_date) {
      const period = String(app.apply_date).slice(0, 7)  // 2026-09
      const { data: invs } = await db
        .from('invoices').select('invoice_no, period, paid_status')
        .eq('seller_id', app.seller_id).eq('period', period)
        // 取り消した請求書は数えない。数えると、誤発行して取り消しただけの月に
        // 出店を一切取り消せなくなる（画面側はこの結果でボタンを押せなくするため、
        // 行き止まりになる）。voided_at が null のものだけが有効な請求書
        .is('voided_at', null)
      if (invs && invs.length > 0) {
        kinds.add('invoice')
        for (const i of invs) seenInvoiceNos.add(i.invoice_no)
        const label = (s: string) =>
          s === 'paid' ? '入金確認済み' : s === 'reported' ? '振込報告済み' : '未入金'
        blockers.push(
          '請求書が発行されています（' +
          invs.map(i => `${i.invoice_no}／${label(String(i.paid_status))}`).join('、') +
          '） → 「売上管理」でその請求書を取り消してから、もう一度お試しください',
        )
      }
    }

    // ⑷ この申込そのものが載っている事前請求
    //    ⑶ は対象月で見るため、請求書の period が出店日の月と違うときに見落とす。
    //    発行時に申込IDを控えている（application_id と items[].applicationId）ので、
    //    それでも確かめる。紙面で手で足した明細行には申込IDが無いので、そこは対象外
    {
      const { data: byApp } = await db
        .from('invoices').select('invoice_no, paid_status, application_id, items')
        .eq('seller_id', app.seller_id).eq('kind', 'advance').is('voided_at', null)
      const hits = (byApp || []).filter(i => {
        if (seenInvoiceNos.has(i.invoice_no)) return false
        if (i.application_id === app.id) return true
        const its = Array.isArray(i.items) ? i.items : []
        return its.some((it: { applicationId?: string }) => it?.applicationId === app.id)
      })
      if (hits.length > 0) {
        kinds.add('invoice')
        const label = (s: string) =>
          s === 'paid' ? '入金確認済み' : s === 'reported' ? '振込報告済み' : '未入金'
        blockers.push(
          'この出店の事前請求が発行されています（' +
          hits.map(i => `${i.invoice_no}／${label(String(i.paid_status))}`).join('、') +
          '） → 「売上管理」でその請求書を取り消してから、もう一度お試しください',
        )
      }
    }

    if (blockers.length > 0) {
      // 当日の記録だけなら、運営が確認のうえ force で取り消せる。
      // 売上報告や請求書があるときは、それを整理するまで取り消せない
      const onlyCheckin = kinds.size === 1 && kinds.has('checkin')
      return NextResponse.json(
        {
          error: onlyCheckin
            ? 'この出店には当日の進行の記録があるため、そのままでは取り消せません。'
            : 'この出店はお金の記録があるため取り消せません。下の項目を先に整理してください。',
          blockers,
          kinds: Array.from(kinds),
          // 画面側で「当日の記録も消して取り消す」を出してよいか
          canForce: onlyCheckin,
        },
        { status: 409 },
      )
    }

    // ---- 取消しを記録する ----
    const { error: upErr } = await db
      .from('applications')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: uid,
        // 知らせずに取り消したこと・当日の記録を消したことを記録に残す。
        // あとから「なぜ連絡が来ていないのか」「なぜ記録が無いのか」を追えるようにするため
        cancel_reason: (() => {
          const r = typeof reason === 'string' && reason.trim() ? reason.trim() : null
          const tags: string[] = []
          if (silent) tags.push('通知なしで取消し')
          if (forced && hasOnsite) tags.push('当日の記録を消して取消し')
          if (tags.length === 0) return r
          return (r ? r + '（' : '') + tags.join('・') + (r ? '）' : '')
        })(),
        // 当日の進行の記録は、取り消した出店に残しておく意味が無い。
        // 残すと「撤収済み」の印が取り消した出店に付いたままになる
        ...(forced && hasOnsite ? {
          confirmed_at: null, checked_in_at: null, ready_at: null,
          opened_at: null, closed_at: null, left_at: null, checkin_seen_at: null,
        } : {}),
      })
      .eq('id', applicationId)
      .eq('status', 'approved')     // 同時に他から変わっていたら書き換えない
    if (upErr) {
      return NextResponse.json({ error: '取消しに失敗しました: ' + upErr.message }, { status: 500 })
    }

    // ---- 知らせる ----
    // キャンセル料が発生するため、出店者本人にも送る。
    // 募集者は会場の準備を進めているので必ず送る。
    // 案件に募集者がひもづいていない取り込み案件があるため、その場合は運営だけ。
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && !silent) {
      const dedupeKey = 'cancel-approved|' + String(applicationId)
      const nowTs = Date.now()
      const lastTs = recentSends.get(dedupeKey)
      if (!(lastTs && nowTs - lastTs < 10000)) {
        recentSends.set(dedupeKey, nowTs)
        if (recentSends.size > 500) {
          for (const [k, t] of recentSends) { if (nowTs - t > 60000) recentSends.delete(k) }
        }

        const { data: place } = await db
          .from('places').select('title, host_id').eq('id', app.place_id).single()
        const { data: host } = place?.host_id
          ? await db.from('profiles').select('name, email').eq('id', place.host_id).single()
          : { data: null }
        const { data: seller } = await db
          .from('profiles').select('name, shop_name, email').eq('id', app.seller_id).single()

        const placeTitle = place?.title || '案件'
        const shopName = seller?.shop_name || seller?.name || '出店者'
        const dateText = app.apply_date || '日程指定なし'
        const reasonText = (typeof reason === 'string' && reason.trim()) ? reason.trim() : '記載なし'
        const resend = new Resend(apiKey)
        const hostName = host?.name || '（案件に募集者が紐づいていません）'

        // 文面は管理画面（メール文面タブ）で書き換えられる。
        // 3通とも宛先も内容も違うので、別々に編集できるようにしている
        const send = async (
          key: string,
          to: string,
          vars: Record<string, string>,
          who: string,
        ) => {
          try {
            const def = MAIL_DEF_BY_KEY[key]
            const mail = await renderMail(db, key, { subject: def.subject, body: def.body }, vars)
            const { error } = await resend.emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to,
              subject: mail.subject,
              text: mail.text,
            })
            // 以前は戻り値の error を見ておらず、失敗してもログにすら残らなかった
            if (error) console.error(who + 'への取消し通知に失敗しました', error.message)
          } catch (e) {
            // 通知が送れなくても取消し自体は完了させる
            console.error(who + 'への取消し通知に失敗しましたが、取消しは完了しました', e)
          }
        }

        // 運営あて。info@ に単独で送り、追加の宛先には1件ずつ送る
        try {
          const def = MAIL_DEF_BY_KEY['cancel-admin']
          const mail = await renderMail(db, 'cancel-admin', { subject: def.subject, body: def.body }, {
            '案件名': placeTitle,
            '出店日': dateText,
            '屋号': shopName,
            '取消しの理由': reasonText,
            '募集者': hostName,
          })
          const { error } = await sendAdminMail(resend, 'cancel', {
            from: '出店コネクトナビ <' + FROM_EMAIL + '>',
            subject: mail.subject,
            text: mail.text,
          })
          if (error) console.error('運営への取消し通知に失敗しました', error.message)
        } catch (e) {
          console.error('運営への取消し通知に失敗しましたが、取消しは完了しました', e)
        }

        // 募集者あて
        if (host?.email) {
          await send('cancel-host', host.email, {
            '宛名': host.name || 'ご担当者',
            '案件名': placeTitle,
            '出店日': dateText,
            '屋号': shopName,
          }, '募集者')
        }

        // 出店者あて。キャンセル料の話があるので必ず知らせる
        if (seller?.email) {
          await send('cancel-seller', seller.email, {
            '宛名': seller.name || 'ご担当者',
            '案件名': placeTitle,
            '出店日': dateText,
          }, '出店者')
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
