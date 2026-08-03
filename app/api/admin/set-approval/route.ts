import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 出店者プロフィールの公開可否を管理者が更新する。
// profiles には管理者用の UPDATE ポリシーが無くクライアントからの更新が
// RLS で無言のうちに弾かれるため、サービスロールで実行する。
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
    const { requesterId, targetId, status } = await req.json()
    if (!requesterId || !targetId || !status) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status が不正です' }, { status: 400 })
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

    const patch: { approval_status: string; approved_at?: string | null } = { approval_status: status }
    if (status === 'approved') patch.approved_at = new Date().toISOString()

    const { data, error } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', targetId)
      .select('id')
    if (error) {
      return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '対象の出店者が見つかりませんでした' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
