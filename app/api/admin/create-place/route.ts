import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 管理者が案件を新規登録する。
// places に管理者向けの INSERT ポリシーがあるとは限らず、クライアントから
// 直接入れると RLS で無言のうちに弾かれるおそれがあるため、
// 承認処理と同じくサービスロールで実行する。
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
    const body = await req.json()
    const { requesterId, place } = body
    if (!requesterId || !place) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (!place.title || !String(place.title).trim()) {
      return NextResponse.json({ error: '案件タイトルを入力してください' }, { status: 400 })
    }
    if (place.status !== 'published' && place.status !== 'draft') {
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

    const num = (v: unknown) => {
      const n = parseInt(String(v ?? ''), 10)
      return Number.isFinite(n) ? n : null
    }
    const row = {
      title: String(place.title).trim(),
      host_id: place.host_id || null,
      description: place.description || null,
      recruit: place.recruit || null,
      prefecture: place.prefecture || null,
      address: place.address || null,
      place_type: place.place_type === 'event' ? 'event' : 'regular',
      genres: Array.isArray(place.genres) && place.genres.length > 0 ? place.genres : null,
      open_days: Array.isArray(place.open_days) && place.open_days.length > 0 ? place.open_days : null,
      open_time: place.open_time || null,
      close_time: place.close_time || null,
      fee: place.fee || null,
      max_slots: num(place.max_slots),
      reminder_days: num(place.reminder_days) ?? 7,
      image_url: place.image_url || null,
      latitude: typeof place.latitude === 'number' ? place.latitude : null,
      longitude: typeof place.longitude === 'number' ? place.longitude : null,
      status: place.status,
      posted_at: new Date().toISOString(),
      // 手数料まわりは既定値のみ入れ、細かい設定は既存の「手数料設定」から行う
      share_tax_basis: 'tax_excluded',
      share_tax_rate: 8,
    }

    const { data, error } = await admin.from('places').insert(row).select('id, title')
    if (error) {
      return NextResponse.json({ error: '登録に失敗しました: ' + error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, place: data?.[0] ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
