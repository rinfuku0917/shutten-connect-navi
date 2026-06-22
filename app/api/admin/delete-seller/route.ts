import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { id, requesterId } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'id がありません' }, { status: 400 })
    }
    if (!requesterId) {
      return NextResponse.json({ error: '認証情報がありません' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    // service_role クライアント（RLSをバイパスできる管理者権限）
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1) リクエスト者が本当に admin かをサーバー側で検証
    const { data: requester, error: reqErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', requesterId)
      .maybeSingle()
    if (reqErr) {
      return NextResponse.json({ error: '権限確認に失敗しました' }, { status: 500 })
    }
    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }

    // 2) 自分自身は削除させない（誤操作防止）
    if (id === requesterId) {
      return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
    }

    // 3) auth.users を削除（profiles は CASCADE で自動削除される）
    const { error: delErr } = await admin.auth.admin.deleteUser(id)
    if (delErr) {
      return NextResponse.json({ error: '削除に失敗しました: ' + delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
