import { getAdminClient, resolveCaller } from './apiAuth'

// 定期実行のAPIを呼べる相手かどうかを判定する。
//
// 通す相手は次の2つだけ。
//   1. Vercel の定期実行（Authorization: Bearer <CRON_SECRET>）
//   2. 管理画面からの手動実行（ログイン中の管理者のアクセストークン）
//
// CRON_SECRET が未設定のときに素通りさせると、URLを知っているだけで
// 記事の投稿や出店者へのメール送信ができてしまうため、必ず拒否する。
//
// 2の判定は app/lib/apiAuth.ts の resolveCaller に寄せている。
// もとはここに getUser + profiles.role の写しがあり、role の読み取りの
// error を見ていなかったため、DBが一瞬落ちただけで 401「権限がありません」に
// 落ちていた（AGENTS.md の「役割の読み取り自体が失敗したときは
// 403 ではなく 503」と食い違っていた）。

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
  if (!secret) return { ok: false, status: 500, error: 'CRON_SECRET が設定されていません' }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  // 1. 定期実行から。鍵の照合を先に行う
  //    （順を逆にすると、鍵の生の値が Supabase の認証ログに残る）
  if (token && token === secret) return { ok: true }
  // URLに鍵を付ける呼び方も残す（Vercel以外から叩くとき用）
  if (new URL(req.url).searchParams.get('key') === secret) return { ok: true }

  // 2. 管理画面から（ログイン中の管理者）
  if (token) {
    const db = getAdminClient()
    // 名乗っている相手なので、サーバーの設定不足はそのまま伝えてよい。
    // 見る順を requireCaller（トークン無し→401、鍵無し→500）にそろえる
    if (!db) return { ok: false, status: 500, error: 'サーバー設定エラー' }

    const caller = await resolveCaller(req, db)
    if (caller?.roleError) {
      // 役割が「読めなかった」のを「運営ではない」と同じ扱いにしない。
      // DBが一瞬落ちただけで「権限がありません」と言われると、
      // 権限を失ったのか一時的な不調なのか切り分けられない
      return { ok: false, status: 503, error: '権限確認に失敗しました。少し待ってもう一度お試しください' }
    }
    if (caller?.isAdmin) return { ok: true }
  }

  return { ok: false, status: 401, error: '権限がありません' }
}
