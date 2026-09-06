import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

// 売上報告の督促を、1件ずつ送る。
//
// 毎朝9時の自動送信（/api/cron/sales-reminder）とは別に、
// 運営が出店管理スケジュールから、その出店枠だけに送れるようにする。
//
// 自動送信は1つの申込につき生涯1回だけだが、こちらは何度でも送れる。
// 送った日時を記録し、画面に「前回 9/3 に送信済み」と出して連打を防ぐ。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
const REPLY_TO = 'info@connect-navi.com'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { db: any; uid: string }

async function requireAdmin(req: Request): Promise<Ctx | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: userData, error: uErr } = await db.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

  const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })

  return { db, uid }
}

// この出店枠へ前回いつ送ったか。画面に出して連打を防ぐ
export async function GET(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const applicationId = new URL(req.url).searchParams.get('applicationId') || ''
  if (!applicationId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  const { data } = await db
    .from('sales_reminder_log')
    .select('sent_at, kind, status')
    .eq('application_id', applicationId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })

  const rows = data || []
  return NextResponse.json({
    count: rows.length,
    lastSentAt: rows.length > 0 ? rows[0].sent_at : null,
  })
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db, uid } = ctx

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'メールの設定がされていません' }, { status: 500 })

  const { applicationId } = await req.json().catch(() => ({}))
  if (!applicationId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  // 対象の出店枠を取る。
  // profiles への結合は外部キー名を明示する（seller_id と cancelled_by の2本あるため）
  const { data: app, error: aErr } = await db
    .from('applications')
    .select('id, seller_id, apply_date, status, places(title), profiles!applications_seller_id_fkey(name, shop_name, email)')
    .eq('id', applicationId)
    .maybeSingle()
  if (aErr) return NextResponse.json({ error: '出店の取得に失敗: ' + aErr.message }, { status: 500 })
  if (!app) return NextResponse.json({ error: '対象の出店が見つかりません' }, { status: 404 })

  // 画面を経由しない呼び出しも含めて、ここで条件を確かめ直す
  if (app.status !== 'approved') {
    return NextResponse.json({ error: '承認済みの出店にのみ送れます' }, { status: 409 })
  }
  const email = app.profiles?.email
  if (!email) {
    return NextResponse.json({ error: 'この出店者のメールアドレスが登録されていません' }, { status: 409 })
  }

  // すでに報告が来ていたら送らない。
  // 報告済みの方へ催促を送るのがいちばん避けたいこと
  const { data: sales, error: sErr } = await db
    .from('sales').select('id').eq('application_id', applicationId).limit(1)
  if (sErr) return NextResponse.json({ error: '売上の確認に失敗: ' + sErr.message }, { status: 500 })
  if (sales && sales.length > 0) {
    return NextResponse.json({ error: 'この出店はすでに売上が報告されています' }, { status: 409 })
  }

  const shopName = app.profiles?.shop_name || app.profiles?.name || '出店者'
  const placeTitle = app.places?.title || '出店案件'
  const [y, m, d] = String(app.apply_date || '').split('-')
  const dateLabel = y ? `${Number(m)}月${Number(d)}日（${y}年）` : '先日'

  // 文面は管理画面（メール文面タブ）で書き換えられる。
  // 書き換えられていなければ、ここに書いた既定の文面が使われる
  const def = MAIL_DEF_BY_KEY['sales-remind']
  const mail = await renderMail(db, 'sales-remind', { subject: def.subject, body: def.body }, {
    '屋号': shopName,
    '出店の一覧': `・${dateLabel} ${placeTitle}`,
  })

  const resend = new Resend(apiKey)
  const { error: mErr } = await resend.emails.send({
    from: '出店コネクトナビ <' + FROM_EMAIL + '>',
    to: email,
    // 返信先を運営の窓口にする。差出人は送信専用のため
    replyTo: REPLY_TO,
    subject: mail.subject,
    text: mail.text,
  })

  if (mErr) {
    const msg = String(mErr.message || mErr)
    await db.from('sales_reminder_log').insert({
      application_id: applicationId, seller_id: app.seller_id, email,
      kind: 'manual', status: 'failed', error: msg.slice(0, 500), sent_by: uid,
    })
    return NextResponse.json({ error: '送信に失敗: ' + msg }, { status: 500 })
  }

  // 送れたことを記録する。これが督促の記録の正本
  await db.from('sales_reminder_log').insert({
    application_id: applicationId, seller_id: app.seller_id, email,
    kind: 'manual', status: 'sent', sent_by: uid,
  })

  // 申込側にも書く。
  //   sales_reminder_sent_at … 出店者の画面に「運営から催促がありました」と出すため
  //   sales_reminded_at      … 自動送信の対象から外すため。
  //     これを入れないと、手で送った翌朝9時に自動送信でもう1通届く
  await db.from('applications').update({
    sales_reminder_sent_at: new Date().toISOString(),
    sales_reminded_at: new Date().toISOString(),
  }).eq('id', applicationId)

  const { data: log } = await db
    .from('sales_reminder_log')
    .select('sent_at')
    .eq('application_id', applicationId).eq('status', 'sent')
    .order('sent_at', { ascending: false })

  return NextResponse.json({
    success: true,
    sentTo: email,
    count: (log || []).length,
    lastSentAt: (log || []).length > 0 ? log[0].sent_at : null,
  })
}
