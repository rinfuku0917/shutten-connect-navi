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

/**
 * 運用の鍵での呼び出しに見えるか（鍵が合っているかは verifyCronCaller が見る）。
 *
 * 運営のトークンでも鍵でも通る入口では、これで先に振り分ける。
 * 順を逆にして先にアクセストークンとして検証すると、Authorization に載った
 * CRON_SECRET がそのまま Supabase の /auth/v1/user へ送られ、
 * 鍵の生の値が認証ログに失敗試行として残ってしまう（サーバー内の
 * 文字列比較で済むはずのものを、外の宛先に出すことになる）。
 */
export function looksLikeCronKeyCall(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  // 鍵と一致するトークン（定期実行・移行スクリプト）
  if (secret && token === secret) return true
  // URLに鍵を付ける呼び方。鍵が未設定でも「鍵で呼ぼうとしている」ことは分かるので、
  // verifyCronCaller に渡して「CRON_SECRET が設定されていません」を返させる
  return new URL(req.url).searchParams.get('key') !== null
}

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
