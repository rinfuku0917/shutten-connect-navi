import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 案件の「募集終了」を切り替える。
//
// 押せるのは、管理者と、その案件を出している募集者本人だけ。
// places の更新は RLS で無言のうちに弾かれることがあるため、
// 権限を確かめたうえでサービスロールで実行する。

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { placeId, closed } = await req.json()
    if (!placeId || typeof closed !== 'boolean') {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    // ログインしている本人を、トークンから確かめる
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const user = userData?.user
    if (uErr || !user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { data: place } = await db.from('places').select('id, host_id').eq('id', placeId).maybeSingle()
    if (!place) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })

    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = me?.role === 'admin'
    const isOwner = place.host_id === user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'この案件を変更する権限がありません' }, { status: 403 })
    }

    const { data: upd, error } = await db
      .from('places')
      .update({ closed, closed_at: closed ? new Date().toISOString() : null })
      .eq('id', placeId)
      .select('id, title, closed')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!upd || upd.length === 0) return NextResponse.json({ error: '更新できませんでした' }, { status: 500 })

    return NextResponse.json({ success: true, place: upd[0] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
