import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMailStandalone, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'
import { sourceLabel } from '../../../lib/signupSource'
import { sendAdminMail } from '../../../lib/notifyRecipients'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { role, name, shop_name, email, phone, areas, found_via, found_note } = body

    // 「何を見て知ったか」を先に記録する。
    // メールより前に置くのは、送信に失敗しても回答が消えないようにするため。
    // 登録の直後は本人としてログインできない（メールの確認が済んでいない）ので、
    // 画面から直接は書けない。ここで受けて残す
    if (found_via || found_note) {
      const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (sUrl && sKey) {
        try {
          const db = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } })
          const { error } = await db.from('signup_sources').insert({
            role: role ? String(role).slice(0, 20) : null,
            name: name ? String(name).slice(0, 200) : null,
            email: email ? String(email).slice(0, 200) : null,
            found_via: found_via ? String(found_via).slice(0, 40) : null,
            found_note: found_note ? String(found_note).slice(0, 500) : null,
          })
          if (error) console.error('登録のきっかけの記録に失敗しました', error.message)
        } catch (e) {
          console.error('登録のきっかけの記録に失敗しました', e)
        }
      }
    }

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
    // 文面は管理画面で編集できるため、差し込みを増やさずに末尾へ添える。
    // 運営がメールを見た時点で、どの入口から来た方か分かるようにする
    const viaLine = found_via
      ? '\n\n──────────\n何を見て知ったか：' + sourceLabel(String(found_via))
        + (found_note ? '（' + String(found_note) + '）' : '')
      : ''
    const text = mail.text + viaLine

    // info@ に単独で送り、追加の宛先には1件ずつ送る（1件の失敗で全員に届かなくなるのを防ぐ）
    const { error } = await sendAdminMail(resend, 'member', {
      from: `出店コネクトナビ <${FROM_EMAIL}>`,
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
