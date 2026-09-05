import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
const ADMIN_EMAIL = 'info@connect-navi.com'

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

    const { applicationId, reason } = await req.json()
    if (!applicationId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

    const { data: app, error: aErr } = await db
      .from('applications')
      .select('id, seller_id, place_id, apply_date, status, checked_in_at')
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

    const { data: sales } = await db
      .from('sales').select('id, sale_date, revenue').eq('application_id', app.id)
    if (sales && sales.length > 0) {
      blockers.push(`売上報告が${sales.length}件あります（${sales.map(s => s.sale_date).join('、')}）`)
    }

    if (app.checked_in_at) {
      blockers.push('当日の受付完了が記録されています（実際に出店されています）')
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
        const label = (s: string) =>
          s === 'paid' ? '入金確認済み' : s === 'reported' ? '振込報告済み' : '未入金'
        blockers.push(
          '請求書が発行されています（' +
          invs.map(i => `${i.invoice_no}／${label(String(i.paid_status))}`).join('、') +
          '）',
        )
      }
    }

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: 'この出店はお金の記録があるため取り消せません。売上と請求を先に整理してください。',
          blockers,
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
        cancel_reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
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
    if (apiKey) {
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

        // 運営あて
        try {
          await resend.emails.send({
            from: '出店コネクトナビ <' + FROM_EMAIL + '>',
            to: ADMIN_EMAIL,
            subject: '【出店取消し】「' + placeTitle + '」' + dateText,
            text: [
              '承認済みの出店を取り消しました。',
              '',
              '案件: ' + placeTitle,
              '出店日: ' + dateText,
              '出店者: ' + shopName,
              '理由: ' + reasonText,
              '募集者: ' + (host?.name || '（案件に募集者が紐づいていません）'),
              '',
              'キャンセルポリシーにより、承認後の取消しはキャンセル料の対象です。',
              '請求が必要かどうかをご確認ください。',
              'https://app.connect-navi.com/admin',
            ].join('\n'),
          })
        } catch (e) {
          console.error('運営への取消し通知に失敗しましたが、取消しは完了しました', e)
        }

        // 募集者あて
        if (host?.email) {
          try {
            await resend.emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to: host.email,
              subject: '【出店コネクトナビ】「' + placeTitle + '」の出店が取り消されました',
              text: [
                (host.name || 'ご担当者') + ' 様',
                '',
                'ご案件「' + placeTitle + '」について、下記の出店が取り消されました。',
                '',
                '出店日: ' + dateText,
                '出店者: ' + shopName,
                '',
                '空いた枠に別の出店者をお探しの場合は、運営までご連絡ください。',
                'https://app.connect-navi.com/dashboard/host',
              ].join('\n'),
            })
          } catch (e) {
            console.error('募集者への取消し通知に失敗しましたが、取消しは完了しました', e)
          }
        }

        // 出店者あて。キャンセル料の話があるので必ず知らせる
        if (seller?.email) {
          try {
            await resend.emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to: seller.email,
              subject: '【出店コネクトナビ】「' + placeTitle + '」の出店取消しを承りました',
              text: [
                (seller.name || 'ご担当者') + ' 様',
                '',
                'ご連絡いただいた下記の出店について、取消しの手続きを行いました。',
                '',
                '案件: ' + placeTitle,
                '出店日: ' + dateText,
                '',
                'なお、出店が確定したあとの取消しはキャンセル料の対象となります。',
                '金額は案件ごとに定めております。追ってご案内いたします。',
                'https://app.connect-navi.com/cancel-policy',
                '',
                'ご不明な点がございましたら、このメールにご返信ください。',
              ].join('\n'),
            })
          } catch (e) {
            console.error('出店者への取消し通知に失敗しましたが、取消しは完了しました', e)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
