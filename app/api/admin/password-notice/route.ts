import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 旧サイトからの移行組へ「パスワードを設定してください」とご案内する。
//
// 会員1,404人のうち1,317人が一度もログインできていない。
// 移行のときにアカウントは作られたが、パスワードは認証システムが
// 自動生成した64文字のランダムな文字列で、本人は知りようがない。
// 再設定する以外に入る手段が無い。
//
// ★ 再設定リンクそのものは送らない。
//    リンクは1時間・1回きりで切れる。1,300通を一斉に送ると、
//    翌朝メールを開いた大半の方が期限切れ画面に着く。
//    ご案内だけを送り、ご本人が /reset-password を開いたときに
//    その場で発行される形にする。
//
// ★ 一度に全員へは送らない。
//    送信ドメインは申込通知・請求通知と同じ。不達が増えると
//    運用中のメールまで届かなくなる。1回100通までにしている。
//
// ★ 勝手には送らない。
//    定期実行からは呼ばれない。運営が画面のボタンを押した回数だけ送る。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
const RESET_URL = 'https://app.connect-navi.com/reset-password'

// 1回の実行で送る上限。これを超える指定が来ても、ここで頭打ちにする
const MAX_PER_RUN = 100

// 100通を順に送るため、既定の実行時間では足りない。
// 売上リマインドの定期実行（sales-reminder）と同じ扱いにする
export const maxDuration = 300

// 送信の間隔。Resend には秒あたりの上限があり、続けて投げると弾かれる。
// 600ミリ秒あければ毎秒2通に届かず、100通で約1分。上の300秒に十分収まる
const SEND_INTERVAL_MS = 600
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { db: any; uid: string }

async function requireAdmin(req: Request): Promise<Ctx | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 呼び出し元をアクセストークンで確かめる。body のIDは信用しない
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

// お送りする文面。
//
// 「あなたはログインできていません」とは書かない。
// 絞り込みは last_sign_in_at に頼っており、万一すり抜けた方に届いても
// 事実に反しない・害が出ない書き方にしておく。
function buildMail(shopName: string) {
  const name = shopName || 'ご登録者'
  return {
    subject: '【出店コネクトナビ】パスワード設定のお願い（新サイトへの移行に伴い）',
    text: `${name} 様

いつも出店コネクトナビをご利用いただきありがとうございます。

旧サイトからの会員情報の引き継ぎに伴い、新サイトでは
パスワードの再設定をお願いしております。
新しく会員登録をしていただく必要はございません。

▼ こちらからパスワードをお決めください
${RESET_URL}

 ① 上のページで、ご登録のメールアドレスを入力
 ② 届いたメールのリンクを開く
 ③ 新しいパスワードを決める

これでログインできるようになります。
メールが見当たらない場合は、迷惑メールフォルダもご確認ください。

すでにログインできている方は、このメールは破棄してください。

ご案内が行き届かず申し訳ございませんでした。
ご不明な点がございましたら、このメールにご返信ください。

出店コネクトナビ運営事務局
株式会社nav`,
  }
}

// 送る前の下見。何人に送ることになるかを返す
export async function GET(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const { data: sum, error: sErr } = await db.rpc('password_notice_summary')
  if (sErr) return NextResponse.json({ error: '集計に失敗: ' + sErr.message }, { status: 500 })

  // 次に送る相手を10人だけ見せる。誰に届くのかを目で確かめてから押せるように
  const { data: preview, error: pErr } = await db.rpc('password_notice_targets', { p_limit: 10 })
  if (pErr) return NextResponse.json({ error: '対象の取得に失敗: ' + pErr.message }, { status: 500 })

  const s = Array.isArray(sum) ? sum[0] : sum
  return NextResponse.json({
    summary: {
      neverLoggedIn: Number(s?.never_logged_in ?? 0),
      alreadySent: Number(s?.already_sent ?? 0),
      remaining: Number(s?.remaining ?? 0),
      emailMismatch: Number(s?.email_mismatch ?? 0),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preview: (preview || []).map((t: any) => ({
      shopName: t.shop_name || t.name || '',
      email: t.email,
      // ご案内の宛先と、再設定メールの宛先が食い違っていないか
      mismatch: String(t.email || '').toLowerCase() !== String(t.auth_email || '').toLowerCase(),
    })),
    maxPerRun: MAX_PER_RUN,
    sampleMail: buildMail('（屋号がここに入ります）'),
  })
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'メールの設定がされていません' }, { status: 500 })
  const resend = new Resend(apiKey)

  const body = await req.json().catch(() => ({}))
  const mode = body?.mode

  // ── テスト送信。指定した1つのアドレスへ、本番と同じ文面を送る。
  //    記録には残さない（会員への送信ではないため）
  if (mode === 'test') {
    const to = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!to) return NextResponse.json({ error: '送り先のアドレスを入れてください' }, { status: 400 })
    const mail = buildMail('テスト 様')
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to,
      subject: '[テスト] ' + mail.subject,
      text: mail.text,
    })
    if (error) return NextResponse.json({ error: '送信に失敗: ' + String(error.message || error) }, { status: 500 })
    return NextResponse.json({ success: true, sentTo: to })
  }

  // ── 本番送信。押した回数だけ、上限まで送る
  if (mode !== 'send') return NextResponse.json({ error: 'mode が不正です' }, { status: 400 })

  const asked = Number(body?.limit)
  const limit = Math.min(Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : MAX_PER_RUN, MAX_PER_RUN)

  const { data: targets, error: tErr } = await db.rpc('password_notice_targets', { p_limit: limit })
  if (tErr) return NextResponse.json({ error: '対象の取得に失敗: ' + tErr.message }, { status: 500 })
  if (!targets || targets.length === 0) {
    return NextResponse.json({ success: true, sent: 0, failed: 0, note: '送る相手がいません' })
  }

  let sent = 0
  let failed = 0
  const errors: string[] = []

  let first = true
  for (const t of targets) {
    // 1通目は待たない。2通目以降は間隔をあけて、秒あたりの上限に当たらないようにする
    if (!first) await wait(SEND_INTERVAL_MS)
    first = false

    const mail = buildMail(t.shop_name || t.name || '')
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: t.email,
      subject: mail.subject,
      text: mail.text,
    })
    if (error) {
      failed += 1
      const msg = String(error.message || error)
      if (errors.length < 5) errors.push(t.email + '：' + msg)
      // 失敗も記録する。あとで送り直す相手を選べるようにするため。
      // status='failed' は「送信済み」に数えないので、次回もう一度対象に入る
      await db.from('password_notice_log').insert({
        seller_id: t.seller_id, email: t.email, status: 'failed', error: msg.slice(0, 500),
      })
      continue
    }
    sent += 1
    // 送れたことを必ず記録する。ここが漏れると同じ人へ何度も届く
    await db.from('password_notice_log').insert({
      seller_id: t.seller_id, email: t.email, status: 'sent',
    })
  }

  // 送ったあとの残り数を返す。画面で「あと何人か」がすぐ分かるように
  const { data: sum } = await db.rpc('password_notice_summary')
  const s = Array.isArray(sum) ? sum[0] : sum

  return NextResponse.json({
    success: true,
    sent,
    failed,
    errors,
    remaining: Number(s?.remaining ?? 0),
  })
}
