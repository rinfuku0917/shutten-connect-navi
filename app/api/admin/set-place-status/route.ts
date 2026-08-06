import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 案件の公開／下書きを管理者が切り替える。
// places の UPDATE も RLS で無言のうちに弾かれるおそれがあるため、
// 登録・承認と同じくサービスロールで実行する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(admin: any, requesterId: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', requesterId)
    .maybeSingle()
  if (error || !data || data.role !== 'admin') return false
  return true
}

export async function POST(req: Request) {
  try {
    const { requesterId, placeId, status } = await req.json()
    if (!requesterId || !placeId || !status) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (status !== 'published' && status !== 'draft') {
      return NextResponse.json({ error: '公開状態が不正です' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }

    const patch: { status: string; posted_at?: string } = { status }
    // 公開に切り替えたときは掲載日を更新し、一覧の新着順で上に出るようにする
    if (status === 'published') patch.posted_at = new Date().toISOString()

    const { data, error } = await admin
      .from('places')
      .update(patch)
      .eq('id', placeId)
      .select('id')
    if (error) {
      return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '対象の案件が見つかりませんでした' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
