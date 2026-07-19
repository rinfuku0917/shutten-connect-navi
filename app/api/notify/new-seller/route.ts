import { Resend } from 'resend'
import { NextResponse } from 'next/server'

// 管理者の通知先（Resend登録アドレスなので onboarding@resend.dev から送れる）
const ADMIN_EMAIL = 'info@connect-navi.com'
const FROM_EMAIL = 'noreply@mail.connect-navi.com'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { role, name, shop_name, email, phone, areas } = body

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'メール設定エラー' }, { status: 500 })
    }

    const resend = new Resend(apiKey)

    const roleLabel = role === 'host' ? '募集者（お店を呼びたい）' : '出店者（出店したい）'
    const areasText = Array.isArray(areas) && areas.length > 0 ? areas.join('・') : '（未設定）'

    const subject = `【出店コネクトナビ】新規${roleLabel}登録: ${name || '名称未設定'} さん`

    const text = [
      '新しい会員が登録しました。',
      '',
      `種別: ${roleLabel}`,
      `氏名: ${name || '（未設定）'}`,
      `店舗名: ${shop_name || '（未設定）'}`,
      `メール: ${email || '（未設定）'}`,
      `電話: ${phone || '（未設定）'}`,
      `エリア: ${areasText}`,
      '',
      '管理画面で詳細を確認してください。',
      'https://shutten-connect-navi-bakv.vercel.app/admin',
    ].join('\n')

    const { error } = await resend.emails.send({
      from: `出店コネクトナビ <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
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
