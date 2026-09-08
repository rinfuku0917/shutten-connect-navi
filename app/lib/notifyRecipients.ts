import { createClient } from '@supabase/supabase-js'

// 運営あて通知メールの宛先を組み立てる。
//
// これまで宛先は info@connect-navi.com のコード直書きだけで、
// 担当者が自分のアドレスでも受け取るにはメールサーバー側の転送に頼るしかなかった。
// 管理画面（メール文面タブ）で足したアドレスを、ここで足して返す。
//
// info@connect-navi.com は必ず先頭に入れる。
// 表を空にしても、誰にも届かない状態にはならないようにするため。

export const ADMIN_EMAIL = 'info@connect-navi.com'

// 通知の種類。表の列名と対応させる
export type NotifyKind = 'contact' | 'member' | 'payment' | 'cancel'

const COLUMN: Record<NotifyKind, string> = {
  contact: 'on_contact',
  member: 'on_member',
  payment: 'on_payment',
  cancel: 'on_cancel',
}

// 宛先の一覧を返す。必ず1件以上返る（最低でも info@）
export async function adminRecipients(kind: NotifyKind): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return [ADMIN_EMAIL]

  try {
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await db
      .from('notify_recipients')
      .select('email')
      .eq('active', true)
      .eq(COLUMN[kind], true)
    // 表がまだ無いときや読めなかったときは、これまでどおり info@ だけに送る。
    // 通知そのものが止まるほうが困る
    if (error || !data) return [ADMIN_EMAIL]

    const extra = (data as { email?: string }[])
      .map(r => String(r.email || '').trim())
      .filter(Boolean)
      .filter(e => e.toLowerCase() !== ADMIN_EMAIL.toLowerCase())

    // 同じアドレスが二重に入らないようにする
    return Array.from(new Set([ADMIN_EMAIL, ...extra]))
  } catch {
    return [ADMIN_EMAIL]
  }
}
