import { Resend } from 'resend'
import { renderMailStandalone, MAIL_DEF_BY_KEY } from './mailTemplates'
import { sourceLabel, historyLabel } from './signupSource'
import { sendAdminMail } from './notifyRecipients'
import { getAdminClient } from './apiAuth'

// 新しい会員（または打ち合わせ希望）を運営へ知らせ、
// 「何を見て知ったか」を signup_sources に残す。
//
// 【なぜ関数に出したか】
//   もとは /api/notify/new-seller の中だけに書いてあり、
//   打ち合わせ希望（/api/meeting-request）はその入口を HTTP で呼んでいた。
//   サーバー内からの fetch は、発信元が実行環境のIPになる。
//   new-seller には連打の上限が付いているので、打ち合わせ希望からのぶんが
//   すべて1つの枠を共有し、案内メールの直後などに相談が立て込むと、
//   6件目以降の運営あて通知が黙って落ちていた
//   （呼び出し側は応答を見ないので、ログにも残らない）。
//
//   HTTPの入口を通さず、この関数を直に呼べばその筋は消える。
//   連打の上限は「ブラウザから直接叩かれる分」だけに掛かる。

export type NewSellerNotice = {
  role?: unknown
  name?: unknown
  shop_name?: unknown
  email?: unknown
  phone?: unknown
  areas?: unknown
  found_via?: unknown
  found_note?: unknown
  contact_history?: unknown
  rep_name?: unknown
}

export type NotifyResult = { ok: true } | { ok: false; status: number; error: string }

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

export async function notifyNewSeller(payload: NewSellerNotice): Promise<NotifyResult> {
  const { role, name, shop_name, email, phone, areas, found_via, found_note, contact_history, rep_name } = payload

  // 「何を見て知ったか」を先に記録する。
  // メールより前に置くのは、送信に失敗しても回答が消えないようにするため。
  // 登録の直後は本人としてログインできない（メールの確認が済んでいない）ので、
  // 画面から直接は書けない。ここで受けて残す
  if (found_via || found_note) {
    const db = getAdminClient()
    if (db) {
      try {
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
  if (!apiKey) return { ok: false, status: 500, error: 'メール設定エラー' }

  const resend = new Resend(apiKey)

  const roleLabel = role === 'host' ? '募集者（お店を呼びたい）' : '出店者（出店したい）'
  const areasText = Array.isArray(areas) && areas.length > 0 ? areas.join('・') : '（未設定）'

  // 文面は管理画面（メール文面タブ）で書き換えられる
  const def = MAIL_DEF_BY_KEY['new-seller']
  const mail = await renderMailStandalone('new-seller', { subject: def.subject, body: def.body }, {
    '種別': roleLabel,
    'お名前': (name as string) || '（未設定）',
    '屋号': (shop_name as string) || '（未設定）',
    'メールアドレス': (email as string) || '（未設定）',
    '電話番号': (phone as string) || '（未設定）',
    'エリア': areasText,
  })
  // 文面は管理画面で編集できるため、差し込みを増やさずに末尾へ添える。
  // 運営がメールを見た時点で、どの入口から来た方か分かるようにする
  const viaLine = found_via
    ? '\n\n──────────\n何を見て知ったか：' + sourceLabel(String(found_via))
      + (found_note ? '（' + String(found_note) + '）' : '')
    : ''
  // やり取りの履歴。初めてでない方に初回の案内を送ってしまうと失礼になるので、
  // 折り返す前に分かるようにしておく。
  // 相談フォーム（/api/meeting-request）からだけ入ってくる
  const histLine = contact_history
    ? '\n弊社とのやり取り：' + historyLabel(String(contact_history))
      + (rep_name ? '（担当：' + String(rep_name) + '）' : '')
    : ''
  const text = mail.text + viaLine + histLine

  // info@ に単独で送り、追加の宛先には1件ずつ送る（1件の失敗で全員に届かなくなるのを防ぐ）
  const { error } = await sendAdminMail(resend, 'member', {
    from: `出店コネクトナビ <${FROM_EMAIL}>`,
    subject: mail.subject,
    text,
  })
  if (error) return { ok: false, status: 500, error: 'メール送信失敗: ' + error.message }

  return { ok: true }
}
