import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { renderMailStandalone, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

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

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['new-seller']
    const mail = await renderMailStandalone('new-seller', { subject: def.subject, body: def.body }, {
      '種別': roleLabel,
      'お名前': name || '（未設定）',
      '屋号': shop_name || '（未設定）',
      'メールアドレス': email || '（未設定）',
      '電話番号': phone || '（未設定）',
      'エリア': areasText,
    })
    const subject = mail.subject
    const text = mail.text

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
