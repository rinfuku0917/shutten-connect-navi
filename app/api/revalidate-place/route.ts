import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 案件を保存したあとに、公開ページを作り直させる。
//
// 一覧・詳細・トップは表示を速くするため一定時間ためこんでいる。
// そのままだと、写真を入れ替えても最大10分ほど古いものが出てしまうため、
// 保存した直後にここを呼んで、その場で作り直す。
//
// 誰でも呼べると無駄に作り直しが走るので、ログインしている人だけに限る。

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    // ここは「ログインしている人かどうか」を確かめるだけなので、匿名キーで足りる
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error } = await db.auth.getUser(token)
    if (error || !userData?.user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { placeId } = await req.json().catch(() => ({}))

    // 案件が出ている場所をまとめて作り直す
    revalidatePath('/places')
    revalidatePath('/')
    if (typeof placeId === 'string' && placeId) revalidatePath('/places/' + placeId)

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
