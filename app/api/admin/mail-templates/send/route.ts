import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { MAIL_DEF_BY_KEY, fillVars } from '../../../../lib/mailTemplates'

// メール文面の画面から、1通だけ手で送る。
//
// なぜ要るか:
//   ふだんのメールは、申込が承認された・書類が差し戻された、といった
//   出来事に合わせて自動で飛ぶ。ところが「あの1件だけもう一度送りたい」
//   「電話で聞かれたので、同じ案内をメールでも送りたい」が実際には起きる。
//   これまでは運営が自分のメールソフトで書き写していた。
//
// 送るのは1回に1通だけ。まとめて送る仕組みは、ここには置かない。
//   ・一斉送信はパスワード案内（/api/admin/password-notice）が持っている
//   ・売上の催促は出店枠ごとの送信（/api/admin/sales-remind）が持っている
//   この2つは送信の記録や重複の防止をそれぞれ持っており、
//   ここから同じものを送ると、その仕組みを素通りしてしまう。
//   だから password-notice と sales-remind は、送ったことを
//   それぞれの記録にも書き込む。

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

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

// 送り先のアドレスから、その人が誰かを調べる。
// 会員なら、屋号やお名前を差し込みの初期値として画面へ返す。
// 手で打ち直すと打ち間違いが起きるため
export async function GET(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const email = (new URL(req.url).searchParams.get('email') || '').trim()
  if (!email) return NextResponse.json({ error: 'アドレスが指定されていません' }, { status: 400 })

  const { data } = await db
    .from('profiles')
    .select('id, role, name, shop_name, email')
    .ilike('email', email)
    .limit(1)
  const p = data && data.length > 0 ? data[0] : null

  // 直近この文面をこのアドレスへ送っていないか。二度送りを防ぐため
  const key = (new URL(req.url).searchParams.get('key') || '').trim()
  let lastSentAt: string | null = null
  if (key) {
    const { data: log } = await db
      .from('mail_send_log')
      .select('sent_at')
      .eq('template_key', key).eq('status', 'sent')
      .ilike('email', email)
      .order('sent_at', { ascending: false })
      .limit(1)
    if (log && log.length > 0) lastSentAt = log[0].sent_at
  }

  return NextResponse.json({
    found: !!p,
    sellerId: p?.id ?? null,
    role: p?.role ?? null,
    name: p?.name ?? '',
    shopName: p?.shop_name ?? '',
    lastSentAt,
  })
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db, uid } = ctx

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'メールの設定がされていません' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const key = typeof body?.key === 'string' ? body.key : ''
  const to = typeof body?.to === 'string' ? body.to.trim() : ''
  const vars: Record<string, string> = (body?.vars && typeof body.vars === 'object') ? body.vars : {}

  const def = MAIL_DEF_BY_KEY[key]
  if (!def) return NextResponse.json({ error: '対象のメールが見つかりません' }, { status: 400 })
  if (!looksLikeEmail(to)) return NextResponse.json({ error: 'メールアドレスの形が正しくありません' }, { status: 400 })

  // 文面は、画面で編集中のものをそのまま送れるようにする。
  // 保存しないと送れないと、送る前に本番の文面が書き換わってしまう
  const subjectSrc = typeof body?.subject === 'string' && body.subject.trim() ? body.subject : def.subject
  const bodySrc = typeof body?.body === 'string' && body.body.trim() ? body.body : def.body

  // この文面が使う差し込みだけを受け取る。
  // 知らない名前が送られてきても入れない（本文に無い値を混ぜないため）
  const use: Record<string, string> = {}
  for (const v of def.vars) use[v.name] = typeof vars[v.name] === 'string' ? vars[v.name] : ''

  const subject = fillVars(subjectSrc, use)
  const text = fillVars(bodySrc, use)

  // 送り先が会員なら控えておく。誰に送ったかを後から追えるようにする
  const { data: pf } = await db
    .from('profiles').select('id').ilike('email', to).limit(1)
  const sellerId = pf && pf.length > 0 ? pf[0].id : null

  const resend = new Resend(apiKey)
  const { error: mErr } = await resend.emails.send({
    from: '出店コネクトナビ <' + FROM_EMAIL + '>',
    to,
    // 差出人は送信専用なので、返信は運営の窓口に届くようにする
    replyTo: REPLY_TO,
    subject,
    text,
  })

  if (mErr) {
    const msg = String(mErr.message || mErr)
    await db.from('mail_send_log').insert({
      template_key: key, email: to, seller_id: sellerId,
      subject, vars: use, status: 'failed', error: msg.slice(0, 500), sent_by: uid,
    })
    return NextResponse.json({ error: '送信に失敗しました: ' + msg }, { status: 500 })
  }

  await db.from('mail_send_log').insert({
    template_key: key, email: to, seller_id: sellerId,
    subject, vars: use, status: 'sent', sent_by: uid,
  })

  // 専用の仕組みを持っている文面は、そちらの記録にも書く。
  // ここから送ったぶんが数えられないと、一斉送信や自動送信が
  // 同じ人へもう一度送ってしまう
  if (key === 'password-notice' && sellerId) {
    await db.from('password_notice_log').insert({
      seller_id: sellerId, email: to, status: 'sent',
    })
  }

  return NextResponse.json({ success: true, sentTo: to, subject })
}
