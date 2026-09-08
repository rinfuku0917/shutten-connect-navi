import { createClient } from '@supabase/supabase-js'
import type { Resend } from 'resend'

// 運営あて通知メールの宛先と、その送り方。
//
// これまで宛先は info@connect-navi.com のコード直書きだけで、
// 担当者が自分のアドレスでも受け取るにはメールサーバー側の転送に頼るしかなかった。
// 管理画面（メール文面タブ）で足したアドレスにも届くようにする。
//
// 送り方が大事で、info@ と追加分を1通の to にまとめてはいけない。
// Resend は宛先の1件でも書式が不正だと送信全体を拒否するので、
// 追加分の打ち間違い1件で info@ にも届かなくなる。
// info@ は必ず単独で送り、追加分はそのあと1件ずつ送る。
// 追加分が失敗しても info@ には届いているし、1件の失敗が他に波及しない。
//
// 1件ずつ送ることで、担当者どうしのアドレスが To に並ばない、という利点もある。
// お問い合わせの通知は Reply-To にお客様のアドレスが入っているので、
// To に並んでいると「全員に返信」でお客様に担当者の個人アドレスが見えてしまう。

export const ADMIN_EMAIL = 'info@connect-navi.com'

// 通知の種類。表の列名と対応させる
export type NotifyKind = 'contact' | 'member' | 'payment' | 'cancel'

const COLUMN: Record<NotifyKind, string> = {
  contact: 'on_contact',
  member: 'on_member',
  payment: 'on_payment',
  cancel: 'on_cancel',
}

// メールアドレスの書式。Resend が受け付ける「email@example.com」の形に限る。
// 追加時（管理API）と送信時の両方で見る。表に変な値が入っていても送信側で落とす
export function isValidEmail(s: string): boolean {
  if (!s || s.length > 200) return false
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(s)) return false
  if (s.includes('..')) return false
  return true
}

// 追加の宛先の一覧（info@ は含まない）。読めなければ空
export async function extraRecipients(kind: NotifyKind): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return []

  try {
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await db
      .from('notify_recipients')
      .select('email')
      .eq('active', true)
      .eq(COLUMN[kind], true)
    // 表がまだ無いときや読めなかったときは追加分なし（info@ には別で送る）
    if (error || !data) return []

    const seen = new Set<string>([ADMIN_EMAIL.toLowerCase()])
    const out: string[] = []
    for (const r of data as { email?: string }[]) {
      const e = String(r.email || '').trim()
      const key = e.toLowerCase()
      // 書式が怪しいものはここで落とす。1件で全体が止まるのを防ぐ
      if (!isValidEmail(e) || seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
    return out
  } catch {
    return []
  }
}

type AdminMail = {
  from: string
  subject: string
  text: string
  replyTo?: string
}

// 運営あて通知を送る。
// 戻り値の error は info@ あての結果。追加分の失敗は extraFailed に入れて返し、
// 呼び出し側の「送れたか」の判断はこれまでどおり info@ で行う
export async function sendAdminMail(
  resend: Resend,
  kind: NotifyKind,
  mail: AdminMail,
): Promise<{ error: { message: string } | null; extraFailed: string[] }> {
  // 1. info@ に単独で送る。ここはこれまでと同じ
  let primaryError: { message: string } | null = null
  try {
    const { error } = await resend.emails.send({ ...mail, to: ADMIN_EMAIL })
    if (error) primaryError = { message: String(error.message || error) }
  } catch (e) {
    primaryError = { message: e instanceof Error ? e.message : String(e) }
  }

  // 2. 追加の宛先に1件ずつ送る。失敗しても他に波及させない
  const extraFailed: string[] = []
  const extras = await extraRecipients(kind)
  for (const to of extras) {
    try {
      const { error } = await resend.emails.send({ ...mail, to })
      if (error) {
        extraFailed.push(to)
        console.error('追加の宛先への通知に失敗しました', to, error.message)
      }
    } catch (e) {
      extraFailed.push(to)
      console.error('追加の宛先への通知に失敗しました', to, e)
    }
  }

  return { error: primaryError, extraFailed }
}
