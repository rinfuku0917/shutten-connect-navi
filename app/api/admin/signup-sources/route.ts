import { NextResponse } from 'next/server'
import { requireCaller, denyNotAdmin } from '../../../lib/apiAuth'

// 「何を見て知ったか」の回答を読む。
//
// signup_sources はお名前とメールアドレスが入るため RLS を有効にして
// ポリシーは作っていない。運営の画面からの参照はここを通す。
//
// 関門は requireCaller を使う（requireAdmin ではない）。
// 参照専用の入口なので 403 の文面を「運営のみが参照できます」にしてあり、
// requireAdmin だと「運営のみが操作できます」に変わってしまう。
// 足切りだけを自分で書き、見る順（トークン無し→401、鍵無し→500、
// 検証失敗→401）は共通の関門に任せる。役割が読めなかったときの 503 は denyNotAdmin。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingTable(error: any) {
  const code = String(error?.code ?? '')
  const msg = String(error?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || msg.includes('public.signup_sources')
}

export async function GET(req: Request) {
  try {
    // 呼び出し元をアクセストークンで確かめる
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx
    // 役割が読めなかったときは 403 ではなく 503（denyNotAdmin が書き分ける）
    if (!caller.isAdmin) return denyNotAdmin(caller, '運営のみが参照できます')

    const { data, error } = await db
      .from('signup_sources')
      .select('role, name, found_via, found_note, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({
          error: '「何を見て知ったか」を保存する表がまだ作られていません。'
            + 'Supabase の SQL Editor で supabase/migrations/20260911_signup_source.sql を実行してください。',
          needsSetup: true,
        }, { status: 503 })
      }
      return NextResponse.json({ error: '取得に失敗しました: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
