import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 管理系APIの「誰として呼んでいるか」を、アクセストークンだけで決める共通の関門。
//
// 【なぜ要るか】
//   管理系の入口の多くは、body の requesterId を profiles.role='admin' と
//   照合するだけだった。requesterId は呼び出し側が自由に書ける値で、
//   持ち主であることを何も証明していない。運営のUUIDが一度でも外に出れば
//   （画面共有・通信の記録・サポートのログ・公開列への取り違え掲載など）、
//   ログインしないまま全権で叩けてしまう。UUIDは失効しないので、
//   漏れた時点で恒久的な裏口になる。
//   2026-09-21 に /api/admin/invoice で見つかり、同じ作りが7本残っていた。
//
//   所有を証明できるのはアクセストークンだけなので、判定をここに寄せる。
//   profiles を読むのはサービスロールキー（RLSを通さない）なので、
//   この関数が唯一の関門になる。各入口にコピーを置くと食い違うため、
//   ここを正とする。
//
// 【使い分け】
//   requireAdmin   … 運営だけが通る入口（ほとんどがこれ）
//   requireCaller  … 「運営なら全件、本人なら自分の分だけ」のように、
//                    403 を即返さず uid と役割の両方が要る入口
//                    （/api/admin/invoice の action:'open' など）。
//                    運営でないと通らないと決めた枝では denyNotAdmin を通す
//   denyNotAdmin   … 「運営でない」と「いま役割が読めない」の書き分け。
//                    requireCaller を使う入口で 403 を返す唯一の窓口
//   resolveCaller  … 上の2つの土台。すでにクライアントを作ってある入口だけ直に使う
//                    （トークン無しの相手に 401 を返す順は呼び出し側の責任になる）

/**
 * サービスロールのクライアント。
 * 表ごとの型は付けていない（Database 型を生成していない）ので、
 * 取り出した行の型は呼び出し側で決める。
 */
export type AdminClient = SupabaseClient

/** サービスロールのクライアントを作る。鍵が無い環境では null */
export function getAdminClient(): AdminClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * サービスロールキーが無いときの応答。
 * 手元の開発環境には鍵を置いていないため、管理系APIはここで止まる。
 */
export function serverConfigResponse(): NextResponse {
  return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
}

export type Caller = {
  uid: string
  role: string | null
  isAdmin: boolean
  /**
   * profiles の読み取り自体に失敗したか。
   * true のとき role / isAdmin は当てにならない（「運営ではない」証拠にならない）。
   */
  roleError: boolean
}

/** Authorization: Bearer のトークンを取り出す。無ければ空文字 */
function bearerToken(req: Request): string {
  const authHeader = req.headers.get('authorization') || ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
}

/**
 * 呼び出し元を、アクセストークンから確かめる。
 * トークンが無い・検証に失敗したときは null（呼び出し側で 401 を返す）。
 * 役割まで返すので、「運営か」「本人か」の分岐を呼び出し側で決められる。
 * 役割を読めなかったときは roleError:true を立てて返す。
 * isAdmin:false を「運営ではない」と読んで 403 にしないこと（呼び出し側で 503 にする）。
 */
export async function resolveCaller(req: Request, db: AdminClient): Promise<Caller | null> {
  const token = bearerToken(req)
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  const uid = data?.user?.id
  if (error || !uid) return null
  const { data: me, error: roleErr } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (roleErr) {
    // 役割が「読めなかった」のを「運営ではない」と同じ扱いにしない。
    // DBが一瞬落ちただけで 403 が返ると、本物の運営には
    // 権限を失ったように見え、原因の切り分けができない。
    // （delete-seller には 500『権限確認に失敗しました』があり、共通化で失われていた）
    console.error('profiles.role の読み取りに失敗しました', roleErr)
    return { uid, role: null, isAdmin: false, roleError: true }
  }
  const role = (me?.role ?? null) as string | null
  return { uid, role, isAdmin: role === 'admin', roleError: false }
}

/** 役割を確かめられなかったときの応答。403 と取り違えないよう別の番号にする */
export function roleCheckFailedResponse(): NextResponse {
  // 権限が無いのではなく、いま確かめられないだけなので 503。
  // 運営には「もう一度お試しください」と伝わる文面にする
  return NextResponse.json({ error: '権限確認に失敗しました。少し待ってもう一度お試しください' }, { status: 503 })
}

/**
 * 「運営でないと通らない」と判定した瞬間に返す応答。
 *
 * ★requireCaller を使う入口では、`if (!caller.isAdmin) return 403` と書かないこと。
 *   caller.isAdmin は false でも「運営ではない」証拠にならない
 *   （役割を読めなかっただけのことがある）。この関数を通せば、
 *   読めなかったときは 503、読めたうえで運営でないときだけ 403 になる。
 *
 * 所有で通る枝（自分の出店・自分の請求書・自分が送ったメッセージなど）では
 * 呼ばない。そこは役割が読めなくても答えが変わらないので、
 * profiles の一瞬の不調で操作を止める必要がない。
 */
export function denyNotAdmin(caller: Caller, message = '運営のみが操作できます'): NextResponse {
  if (caller.roleError) return roleCheckFailedResponse()
  return NextResponse.json({ error: message }, { status: 403 })
}

export type AdminCaller = { uid: string; db: AdminClient }

/**
 * 運営だけが通る入口の関門。
 *
 * 通ったときは uid とサービスロールのクライアントを返す。
 * 通らなかったときは、そのまま返せる応答を返す（呼び出し側で早期 return）。
 * 見る順に並べると、
 *   ・トークンが無い … 401 認証が必要です
 *   ・鍵が無い       … 500 サーバー設定エラー（手元の開発環境はここで止まる）
 *   ・トークンが不正 … 401 認証に失敗しました
 *   ・役割が読めない … 503 権限確認に失敗しました
 *   ・運営ではない   … 403 運営のみが操作できます
 *
 * db を渡さなければここで作る。すでに作ってある入口は渡して使い回す。
 */
export async function requireAdmin(req: Request, db?: AdminClient): Promise<AdminCaller | NextResponse> {
  const ctx = await requireCaller(req, db)
  if (ctx instanceof NextResponse) return ctx
  // 役割が読めなかったときは 503。denyNotAdmin がその書き分けを持っている
  if (!ctx.caller.isAdmin) return denyNotAdmin(ctx.caller)
  return { uid: ctx.caller.uid, db: ctx.db }
}

export type CallerContext = { caller: Caller; db: AdminClient }

/**
 * 「運営なら全件・本人なら自分の分だけ」型の入口の関門。
 *
 * 役割での足切りはしないので、403 を返すかどうかは呼び出し側で決める。
 * 見る順は トークン無し→401、鍵無し→500、検証失敗→401。
 *
 * ★役割の読み取りの失敗（roleError）で足切りはしない。
 *   この関門を通る入口には「所有で通る枝」が必ずあり
 *   （自分の出店の記録・自分の請求書・自分が送ったメッセージなど）、
 *   そこは役割が読めなくても答えが変わらない。ここで 503 を返すと、
 *   profiles の一瞬の不調で、以前は通っていた操作まで止まる
 *   （当日の進行は現場のスマホから1出店で6回押される導線）。
 *   代わりに roleError をそのまま caller に載せて返す。
 *   「運営でないと通らない」と判定する側が denyNotAdmin を通せば、
 *   読めなかったときは 503、読めたうえで運営でないときだけ 403 になる。
 *   `if (!caller.isAdmin) return 403` と直に書かないこと。
 *
 * resolveCaller を直に使うと、サービスロールのクライアントを先に作ることになり、
 * 鍵の無い環境では名乗っていない相手にも 500（設定状態）を返してしまう。
 * その順を各入口で書き写さないために、ここに寄せる。
 *
 * authMessage … 401 の文面を差し替える。出店者も叩く入口では、
 *   「ログインしなおしてからお試しください」のように画面の言い方に合わせたいため。
 *   省略すると requireAdmin と同じ（無い／不正で別の文面）
 */
export async function requireCaller(
  req: Request,
  db?: AdminClient,
  authMessage?: string,
): Promise<CallerContext | NextResponse> {
  // トークンが無い相手は、鍵の有無を見るより先に断る。
  // 名乗っていない相手に、サーバーの設定状態（500）まで教える必要はない
  const token = bearerToken(req)
  if (!token) return NextResponse.json({ error: authMessage ?? '認証が必要です' }, { status: 401 })

  const client = db ?? getAdminClient()
  if (!client) return serverConfigResponse()

  const caller = await resolveCaller(req, client)
  if (!caller) return NextResponse.json({ error: authMessage ?? '認証に失敗しました' }, { status: 401 })

  return { caller, db: client }
}
