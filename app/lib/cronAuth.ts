import { createClient } from '@supabase/supabase-js'

// 定期実行のAPIを呼べる相手かどうかを判定する。
//
// 通す相手は次の2つだけ。
//   1. Vercel の定期実行（Authorization: Bearer <CRON_SECRET>）
//   2. 管理画面からの手動実行（ログイン中の管理者のアクセストークン）
//
// CRON_SECRET が未設定のときに素通りさせると、URLを知っているだけで
// 記事の投稿や出店者へのメール送信ができてしまうため、必ず拒否する。

export type CronAuthResult = { ok: true } | { ok: false; status: number; error: string }

export async function verifyCronCaller(req: Request): Promise<CronAuthResult> {
  const secret = process.env.CRON_SECRET
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return { ok: false, status: 500, error: 'CRON_SECRET が設定されていません' }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  // 1. 定期実行から
  if (token && token === secret) return { ok: true }
  // URLに鍵を付ける呼び方も残す（Vercel以外から叩くとき用）
  if (new URL(req.url).searchParams.get('key') === secret) return { ok: true }

  // 2. 管理画面から（ログイン中の管理者）
  if (token && url && serviceKey) {
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: userData } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uid) {
      const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (me?.role === 'admin') return { ok: true }
    }
  }

  return { ok: false, status: 401, error: '権限がありません' }
}
