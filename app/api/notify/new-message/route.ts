import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { requireCaller, serverConfigResponse, denyNotAdmin } from '../../../lib/apiAuth'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'
import { SITE_URL } from '../../../lib/seo'
import { sendAdminMail, ADMIN_EMAIL } from '../../../lib/notifyRecipients'

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
    const { applicationId, direct, receiverId } = await req.json()
    const isDirect = direct === true
    if (!isDirect && !applicationId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    // 送信者はトークンの持ち主。DBを読む前に決めるので、
    // body の値で「誰として送ったか」を差し替えられない。
    // 見る順は requireCaller のまま（トークン無し→401、鍵無し→500、検証失敗→401）。
    // 役割が読めなかったかどうかは、下の 403 の判定で denyNotAdmin が見る
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx
    const senderId = caller.uid

    // メールの鍵は、名乗った相手だと分かってから見る
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return serverConfigResponse()

    // ---- 案件に紐づかない直接のやり取り（運営 ↔ 募集者。2026-09-26） ----
    if (isDirect) {
      if (receiverId) {
        // 運営 → 募集者。宛先を指定できるのは運営だけ（送信の入口と同じ決まり）
        if (!caller.isAdmin) return denyNotAdmin(caller, '宛先を指定できるのは運営だけです')
        const { data: rcv } = await db
          .from('profiles').select('name, shop_name, email, role').eq('id', String(receiverId)).maybeSingle()
        if (!rcv?.email) return NextResponse.json({ error: '宛先のメールアドレスが分かりません' }, { status: 404 })
        if (rcv.role !== 'host') return NextResponse.json({ error: 'この送り方は募集者あてだけです' }, { status: 400 })
        const defD = MAIL_DEF_BY_KEY['new-message']
        const mailD = await renderMail(db, 'new-message', { subject: defD.subject, body: defD.body }, {
          '宛名': rcv.shop_name || rcv.name || 'ご担当者',
          // この文面は案件名を差し込む作りなので、直接のやり取りではその代わりを入れる
          '案件名': '運営事務局からのご連絡',
          '案内文': 'マイページの「メッセージ」の一番上に「運営事務局」として表示されます。',
          'メッセージ画面のURL': SITE_URL + '/dashboard/host/messages',
        })
        const { error: eD } = await new Resend(apiKey).emails.send({
          from: '出店コネクトナビ <' + FROM_EMAIL + '>',
          to: rcv.email, subject: mailD.subject, text: mailD.text,
        })
        if (eD) return NextResponse.json({ error: 'メール送信失敗: ' + eD.message }, { status: 500 })
        return NextResponse.json({ success: true, direct: true })
      }
      // 募集者 → 運営。運営の受信箱へ知らせる
      const { data: me } = await db
        .from('profiles').select('name, shop_name, email, phone').eq('id', senderId).maybeSingle()
      const who = me?.shop_name || me?.name || '(名前未登録)'
      const { error: eA } = await sendAdminMail(new Resend(apiKey), 'contact', {
        from: '出店コネクトナビ <' + FROM_EMAIL + '>',
        replyTo: ADMIN_EMAIL,
        subject: '【メッセージ】募集者から運営あてに届きました：' + who,
        text: [
          '募集者から、案件に紐づかないメッセージが届きました。',
          '',
          '送り主：' + who + '（' + (me?.email ?? 'メール未登録') + ' / ' + (me?.phone ?? '電話未登録') + '）',
          '',
          '管理画面の「募集者管理」から、その募集者の「この募集者にメッセージを送る」で読めます。',
          '',
          SITE_URL + '/admin?tab=hosts',
        ].join('\n'),
      })
      if (eA) return NextResponse.json({ error: 'メール送信失敗: ' + eA.message }, { status: 500 })
      return NextResponse.json({ success: true, direct: true })
    }

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
    // 当事者なら役割を見ずに通る。運営でないと通らないと決まった今だけ、
    // 役割が読めていたかを確かめる（読めていなければ 403 ではなく 503）
    if (senderId !== app.seller_id && senderId !== hostId && !caller.isAdmin) {
      return denyNotAdmin(caller, 'このやり取りの通知は送れません')
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
