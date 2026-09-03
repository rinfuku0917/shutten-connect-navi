import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'

// 売上報告のリマインド。Vercel の定期実行（毎朝9時）から呼ばれる。
//
// 出店日が過ぎたのに売上報告が無い承認済みの申込を探し、
// 出店者へメールで報告をお願いする。
//   ・出店日の翌日から対象（当日はまだ営業中のことがあるため）
//   ・古すぎるもの（14日以上前）は対象にしない
//   ・同じ申込には一度しか送らない（applications.sales_reminded_at で管理）
//   ・同じ出店者の複数件は1通にまとめる

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

// 出店者ごとに1通ずつ順に送るため、既定の実行時間では足りないことがある
export const maxDuration = 300

export async function GET(req: Request) {
  const auth = await verifyCronCaller(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const apiKey = process.env.RESEND_API_KEY
    if (!sUrl || !sKey || !apiKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // 日付は日本時間で判定する（サーバーはUTCで動くため）
    const nowJst = new Date(Date.now() + 9 * 3600 * 1000)
    const today = nowJst.toISOString().slice(0, 10)
    const from = new Date(nowJst.getTime() - 14 * 86400000).toISOString().slice(0, 10)

    const { data: apps, error } = await db
      .from('applications')
      .select('id, seller_id, apply_date, profiles!applications_seller_id_fkey(shop_name, name, email), places(title)')
      .eq('status', 'approved')
      .is('sales_reminded_at', null)
      .not('apply_date', 'is', null)
      .gte('apply_date', from)
      .lt('apply_date', today)
    if (error) return NextResponse.json({ error: '申込の取得に失敗: ' + error.message }, { status: 500 })
    if (!apps || apps.length === 0) return NextResponse.json({ success: true, sent: 0, note: '対象なし' })

    // 既に売上報告がある申込は外す
    const appIds = apps.map(a => a.id)
    // ここが失敗すると「全員が未報告」と誤判定して、報告済みの出店者にも
    // 催促が飛んでしまう。取得できなかったときは何も送らずに中断する。
    const { data: reported, error: rErr } = await db.from('sales').select('application_id').in('application_id', appIds)
    if (rErr) return NextResponse.json({ error: '売上の取得に失敗: ' + rErr.message }, { status: 500 })
    const reportedSet = new Set((reported || []).map(r => r.application_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targets = (apps as any[]).filter(a => !reportedSet.has(a.id) && a.profiles?.email)

    // 報告済みの申込は「送った扱い」にして、以降の対象から外す
    const done = apps.filter(a => reportedSet.has(a.id)).map(a => a.id)
    if (done.length > 0) await db.from('applications').update({ sales_reminded_at: new Date().toISOString() }).in('id', done)

    if (targets.length === 0) return NextResponse.json({ success: true, sent: 0, note: '未報告なし' })

    // 出店者ごとに1通にまとめる
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bySeller = new Map<string, any[]>()
    for (const a of targets) {
      const list = bySeller.get(a.seller_id) || []
      list.push(a)
      bySeller.set(a.seller_id, list)
    }

    const resend = new Resend(apiKey)
    let sent = 0
    const errors: string[] = []
    // 念のため1回の実行で送る通数に上限を設ける
    const sellers = [...bySeller.entries()].slice(0, 100)

    for (const [, list] of sellers) {
      const p = list[0].profiles
      const shopName = p.shop_name || p.name || '出店者'
      const lines = list
        .sort((a, b) => (a.apply_date < b.apply_date ? -1 : 1))
        .map(a => {
          const [y, m, d] = String(a.apply_date).split('-')
          return `・${Number(m)}月${Number(d)}日（${y}年） ${a.places?.title || '出店案件'}`
        })
      const { error: mErr } = await resend.emails.send({
        from: '出店コネクトナビ <' + FROM_EMAIL + '>',
        to: p.email,
        subject: '【出店コネクトナビ】売上報告のお願い',
        text: `${shopName} 様

いつも出店コネクトナビをご利用いただきありがとうございます。

以下のご出店について、売上報告がまだ確認できておりません。
お手数ですが、マイページの「売上報告」からご入力をお願いいたします。

${lines.join('\n')}

▼ 売上報告はこちら（開くと「売上報告」の画面が出ます）
https://app.connect-navi.com/dashboard/seller?tab=sales

すでにご報告いただいている場合は、行き違いですのでご容赦ください。
ご不明な点がございましたら、このメールにご返信ください。

出店コネクトナビ運営事務局
株式会社nav`,
      })
      if (mErr) { errors.push(String(mErr.message || mErr)); continue }
      sent += 1
      // マークに失敗すると翌日また同じメールが飛ぶため、失敗を記録して気付けるようにする
      const { error: uErr } = await db.from('applications')
        .update({ sales_reminded_at: new Date().toISOString() })
        .in('id', list.map(a => a.id))
      if (uErr) errors.push('送信済みの記録に失敗: ' + uErr.message)
    }

    return NextResponse.json({ success: true, sent, targets: targets.length, errors: errors.slice(0, 3) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
