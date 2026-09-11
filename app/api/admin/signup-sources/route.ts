import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 「何を見て知ったか」の回答を読む。
//
// signup_sources はお名前とメールアドレスが入るため RLS を有効にして
// ポリシーは作っていない。運営の画面からの参照はここを通す。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingTable(error: any) {
  const code = String(error?.code ?? '')
  const msg = String(error?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || msg.includes('public.signup_sources')
}

export async function GET(req: Request) {
  try {
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    // 呼び出し元をアクセストークンで確かめる
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
    if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが参照できます' }, { status: 403 })

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
