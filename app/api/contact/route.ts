import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const FROM_EMAIL = 'noreply@connect-navi.com'
const TO_EMAIL = 'info@connect-navi.com'

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: '必須項目が未入力です' }, { status: 400 })
    }
    if (!String(email).includes('@')) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    const nm = String(name).trim()
    const em = String(email).trim()
    const msg = String(message).trim()

    const subject = '【お問い合わせ】' + nm + ' 様より'
    const text = [
      '出店コネクトナビのお問い合わせフォームから送信がありました。',
      '',
      '━━━━━━━━━━━━━━━━━━',
      'お名前: ' + nm,
      'メール: ' + em,
      '━━━━━━━━━━━━━━━━━━',
      '',
      '【お問い合わせ内容】',
      msg,
      '',
      '━━━━━━━━━━━━━━━━━━',
      '※このメールに返信すると、送信者(' + em + ')に直接届きます。',
    ].join('\n')

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: TO_EMAIL,
      replyTo: em,
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
