import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendAdminMail } from '../../../lib/notifyRecipients'

// 申込の出店日を振り替える。
//
// なぜ要るか:
//   「日程を間違えてエントリーした」という連絡が実際に来る。
//   これまでは取り消して入れ直してもらうしかなく、出店者に手間をかけていた。
//   募集が終わっている案件では入れ直しもできない（新しい申込は締切で弾かれる）。
//
// 誰ができるか:
//   運営だけ。出店者や募集者が自由に日付を動かせると、
//   募集者の準備と食い違う。連絡を受けて運営が処理する形を守る。
//
// 振り替えないもの（取消しと同じ考え方）:
//   ・売上報告がある … 実際に出店して報告まで済んでいる
//   ・請求書がある … 請求を出してしまっている
//   ・当日の進行の記録がある … 実際に現場に入っている
//   お金と現場の記録が付いた日を動かすと、どの日の売上か分からなくなる。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

const jpDate = (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  const w = ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}年${m}月${d}日（${w}）`
}

export async function POST(req: Request) {
  try {
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    // 呼び出し元をアクセストークンで確かめる
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: '運営のみが出店日を変更できます' }, { status: 403 })
    }

    const { applicationId, newDate, reason, notify } = await req.json()
    const silent = notify === false
    if (!applicationId) return NextResponse.json({ error: '申込が指定されていません' }, { status: 400 })
    const nd = String(newDate ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) {
      return NextResponse.json({ error: '新しい出店日をご確認ください' }, { status: 400 })
    }

    const { data: app, error: aErr } = await db
      .from('applications')
      .select('id, seller_id, place_id, apply_date, status, confirmed_at, checked_in_at, ready_at, opened_at, closed_at, left_at')
      .eq('id', applicationId).maybeSingle()
    if (aErr) {
      console.error('申込の取得に失敗しました', aErr.message)
      return NextResponse.json({ error: '申込を読み込めませんでした。時間をおいてお試しください' }, { status: 500 })
    }
    if (!app) return NextResponse.json({ error: '申込が見つかりません' }, { status: 404 })

    if (app.status !== 'approved' && app.status !== 'pending') {
      return NextResponse.json(
        { error: '審査中か承認済みの申込だけ日付を変えられます' },
        { status: 409 },
      )
    }
    if (app.apply_date === nd) {
      return NextResponse.json({ error: 'いまと同じ日付です' }, { status: 400 })
    }

    // ---- 動かしてよい日かを確かめる ----
    const blockers: string[] = []

    const { data: sales } = await db
      .from('sales').select('id, sale_date').eq('application_id', app.id)
    if (sales && sales.length > 0) {
      blockers.push(
        '売上報告が' + sales.length + '件あります（'
        + sales.map((s: { sale_date: string }) => s.sale_date).join('、')
        + '）。日付を動かすと、どの日の売上か分からなくなります',
      )
    }

    const ONSITE = ['confirmed_at', 'checked_in_at', 'ready_at', 'opened_at', 'closed_at', 'left_at'] as const
    if (ONSITE.some(c => (app as Record<string, unknown>)[c])) {
      blockers.push('当日の進行（車両の搬入〜撤収）が記録されています。実際に出店された日は動かせません')
    }

    // 請求書。その申込に紐づくもの、明細に載っているもの、
    // そして「動かす前の月」と「動かした先の月」の両方を見る。
    // 移動先の月だけ見ないと、すでに請求を出した月へ日付を入れられてしまい、
    // 確定した請求書の中身と実際の出店がずれる
    const { data: invs } = await db
      .from('invoices').select('invoice_no, period, application_id, items')
      .eq('seller_id', app.seller_id).is('voided_at', null)
    // items は jsonb だが、文字列で入っている行もある。文字列なら読み直す
    const itemsOf = (raw: unknown): { applicationId?: string }[] => {
      if (Array.isArray(raw)) return raw as { applicationId?: string }[]
      if (typeof raw === 'string') {
        try {
          const v = JSON.parse(raw)
          if (Array.isArray(v)) return v
          if (v && Array.isArray(v.items)) return v.items
        } catch { /* 読めない形は空として扱う */ }
      }
      if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)) {
        return (raw as { items: { applicationId?: string }[] }).items
      }
      return []
    }
    const months = new Set(
      [app.apply_date ? String(app.apply_date).slice(0, 7) : '', nd.slice(0, 7)].filter(Boolean),
    )
    const hit = (invs || []).filter((i: { period?: string; application_id?: string; items?: unknown }) => {
      if (i.application_id === app.id) return true
      if (itemsOf(i.items).some(it => it?.applicationId === app.id)) return true
      return !!i.period && months.has(i.period)
    })
    if (hit.length > 0) {
      blockers.push(
        '請求書が発行されています（'
        + hit.map((i: { invoice_no: string; period?: string }) => i.invoice_no + (i.period ? '／' + i.period : '')).join('、')
        + '）。動かす前の月と動かす先の月の両方を見ています。先に「売上管理」でその請求書を取り消してください',
      )
    }

    if (blockers.length > 0) {
      return NextResponse.json({
        error: 'この出店日は動かせません。下の項目をご確認ください。',
        blockers,
      }, { status: 409 })
    }

    // 案件の日程に含まれる日かを確かめる。
    // 日程を持たない案件（常設・日程未定）は、この確認をしない
    const { data: place } = await db
      .from('places').select('title, host_id, schedule').eq('id', app.place_id).maybeSingle()
    const sched = Array.isArray(place?.schedule) ? place.schedule : []
    const days = sched.map((d: { date?: string }) => String(d?.date || '')).filter(Boolean)
    if (days.length > 0 && !days.includes(nd)) {
      return NextResponse.json({
        error: 'その日はこの案件の日程に入っていません。案件の日程に無い日へは振り替えられません。',
        availableDates: days,
      }, { status: 409 })
    }

    // 同じ出店者が、その日に別の申込を持っていないか
    // .neq('status','cancelled') だけだと、status が NULL の行が
    // Postgres の NULL 比較で結果から落ちる。or で拾う
    const { data: dup } = await db
      .from('applications').select('id, status')
      .eq('place_id', app.place_id).eq('seller_id', app.seller_id).eq('apply_date', nd)
      .or('status.is.null,status.neq.cancelled')
    if (dup && dup.length > 0) {
      return NextResponse.json({
        error: 'その日には、この出店者の申込がすでに入っています。重ねての振り替えはできません。',
      }, { status: 409 })
    }

    const before = app.apply_date
    const { data: upd, error: upErr } = await db
      .from('applications')
      .update({
        apply_date: nd,
        date_changed_at: new Date().toISOString(),
        date_changed_by: uid,
        date_changed_from: before,
        date_change_reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
      })
      .eq('id', applicationId)
      // 同時に他から変わっていたら書き換えない。
      // status だけだと、別の運営が先に日付を動かしていたときに
      // 黙って上書きし、変更前の日付の記録も食い違う
      .eq('status', app.status)
      .eq('apply_date', app.apply_date)
      .select('id')
    if (upErr) {
      // 何ヶ月先まで申し込めるかの上限（データベース側の確認）で弾かれることがある
      return NextResponse.json({ error: '変更できませんでした: ' + upErr.message }, { status: 409 })
    }
    if (!upd || upd.length === 0) {
      return NextResponse.json({
        error: '変更できませんでした。この申込は、ほかの操作で日付か状態が変わった可能性があります。画面を読み直してからお試しください',
      }, { status: 409 })
    }

    // ---- 知らせる ----
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && !silent) {
      const { data: seller } = await db
        .from('profiles').select('name, shop_name, email').eq('id', app.seller_id).maybeSingle()
      const { data: host } = place?.host_id
        ? await db.from('profiles').select('name, email').eq('id', place.host_id).maybeSingle()
        : { data: null }
      const resend = new Resend(apiKey)
      const placeTitle = place?.title || '案件'
      const shopName = seller?.shop_name || seller?.name || '(出店者)'
      const beforeText = before ? jpDate(before) : '（日付なし）'
      const afterText = jpDate(nd)

      const body = [
        placeTitle + ' の出店日を変更しました。',
        '',
        '出店者：' + shopName,
        '変更前：' + beforeText,
        '変更後：' + afterText,
        typeof reason === 'string' && reason.trim() ? '理由：' + reason.trim() : '',
        '',
        'ご不明な点は運営（info@connect-navi.com）までご連絡ください。',
      ].filter(Boolean).join('\n')

      const send = async (to: string, name: string, who: string) => {
        try {
          await resend.emails.send({
            from: '出店コネクトナビ <' + FROM_EMAIL + '>',
            to,
            subject: '【出店コネクトナビ】出店日の変更（' + placeTitle + '）',
            text: (name ? name + ' 様\n\n' : '') + body,
          })
        } catch (e) {
          console.error(who + 'への日程変更の通知に失敗しました', e)
        }
      }
      if (seller?.email) await send(seller.email, seller.name || 'ご担当者', '出店者')
      if (host?.email) await send(host.email, host.name || 'ご担当者', '募集者')
      try {
        const { error } = await sendAdminMail(resend, 'cancel', {
          from: '出店コネクトナビ <' + FROM_EMAIL + '>',
          subject: '【運営】出店日の変更（' + placeTitle + '／' + shopName + '）',
          text: body,
        })
        if (error) console.error('運営への日程変更の通知に失敗しました', error.message)
      } catch (e) {
        console.error('運営への日程変更の通知に失敗しました', e)
      }
    }

    return NextResponse.json({ success: true, from: before, to: nd })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
