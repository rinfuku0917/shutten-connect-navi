import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { requireCaller, serverConfigResponse } from '../../../lib/apiAuth'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'
import { SITE_URL } from '../../../lib/seo'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

const recentSends = new Map();

// 新着メッセージのお知らせメールを相手へ出す。
//
// 送信者は body で受け取らない。アクセストークンの uid をそのまま送信者とする。
// 以前は body の senderId で宛先（出店者か募集者か）を振り分けていたため、
// 申込のIDを知っている者（自分の申込を持つ出店者など）なら、senderId を
// 差し替えて相手側にだけ「新しいメッセージ」通知を出させられた。
// 誰として呼んでいるかはトークンだけで決める（notify/new-application と同じ形）。
// 判定は app/lib/apiAuth.ts の関門に寄せる（各入口に書き写すと食い違うため。
// 役割が読めなかったときに 403 ではなく 503 を返すのも、そこに揃える）。
export async function POST(req: Request) {
  try {
    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    // 送信者はトークンの持ち主。DBを読む前に決めるので、
    // body の値で「誰として送ったか」を差し替えられない。
    // 見る順は requireCaller のまま（トークン無し→401、鍵無し→500、
    // 検証失敗→401、役割が読めない→503）
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx
    const senderId = caller.uid

    // メールの鍵は、名乗った相手だと分かってから見る
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return serverConfigResponse()

    // 申込 → 出店者・案件・ホストを解決
    const { data: app, error: aErr } = await db
      .from('applications').select('seller_id, place_id').eq('id', applicationId).single()
    if (aErr || !app) {
      return NextResponse.json({ error: '申込取得失敗' }, { status: 500 })
    }
    const { data: place } = await db
      .from('places').select('title, host_id').eq('id', app.place_id).single()
    const hostId = place?.host_id || null
    const placeTitle = place?.title || '案件'

    // このやり取りの当事者か。運営は代わりに返すことがあるので通す。
    // 当事者でない相手には、宛先も件名も作らせない。
    // 役割は関門が読んでいる（読めなかったときは、ここへ来る前に 503 で止まる）
    if (senderId !== app.seller_id && senderId !== hostId && !caller.isAdmin) {
      return NextResponse.json({ error: 'このやり取りの通知は送れません' }, { status: 403 })
    }

    // 送信者から受信者を決定（運営が送ったときは出店者あて。これまでと同じ）
    let recipientId: string | null
    let recipientIsHost = false
    if (senderId === app.seller_id) {
      recipientId = hostId
      recipientIsHost = true
    } else if (hostId && senderId === hostId) {
      recipientId = app.seller_id
    } else {
      recipientId = app.seller_id
    }
    if (!recipientId) {
      return NextResponse.json({ success: true, skipped: 'no_recipient' })
    }

    // 連投抑制: 送信者からの未読が既に複数あるなら追い通知しない
    const { count } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('sender_id', senderId)
      .is('read_at', null)
    if (count && count > 1) {
      return NextResponse.json({ success: true, skipped: 'throttled' })
    }

    const { data: recipient, error: rErr } = await db
      .from('profiles').select('name, email').eq('id', recipientId).single()
    if (rErr || !recipient || !recipient.email) {
      return NextResponse.json({ error: '受信者取得失敗' }, { status: 500 })
    }

    // ドメインは SITE_URL から。ルートドメインへ移ったときに古いリンクを送らないため
    const dashUrl = recipientIsHost
      ? `${SITE_URL}/dashboard/host/messages`
      : `${SITE_URL}/dashboard/seller?tab=messages`

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['new-message']
    const mail = await renderMail(db, 'new-message', { subject: def.subject, body: def.body }, {
      '宛名': recipient.name || 'ご担当者',
      '案件名': placeTitle,
      '案内文': recipientIsHost
        ? 'ログインしてご確認ください。'
        : '下のリンクを開くと、マイページの「メッセージ」が開きます。',
      'メッセージ画面のURL': dashUrl,
    })
    const subject = mail.subject
    const text = mail.text

    const resend = new Resend(apiKey)
    const dedupeKey = String(recipientId) + '|' + String(placeTitle);
    const nowTs = Date.now();
    const lastTs = recentSends.get(dedupeKey);
    if (lastTs && nowTs - lastTs < 10000) {
      return NextResponse.json({ ok: true, skipped: 'duplicate' });
    }
    recentSends.set(dedupeKey, nowTs);
    if (recentSends.size > 500) {
      for (const [k, t] of recentSends) { if (nowTs - t > 60000) recentSends.delete(k); }
    }
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: recipient.email,
      subject,
      text,
    })
    if (error) {
      return NextResponse.json({ error: 'メール送信失敗: ' + error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
