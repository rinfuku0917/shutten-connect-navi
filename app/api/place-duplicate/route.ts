import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 案件を複製する。
//
// 同じ会場で月ごとに募集を出し直すことが多いため、
// 前の案件をそのまま複製して、日程や題名だけ直せるようにする。
//
// 複製したものは必ず「下書き」で作る。中身を直さないまま
// 公開されてしまうと、古い日程のまま募集が出てしまうため。

// 複製しない項目。これらは新しい案件として作り直す。
const SKIP = new Set([
  'id',
  'created_at',
  'posted_at',   // 掲載日は公開したときに入る
  'closed',      // 募集終了の状態は引き継がない
  'closed_at',
  'pinned',      // 上位表示は引き継がない
  'urgent',      // 急募も引き継がない
])

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { placeId } = await req.json()
    if (!placeId) return NextResponse.json({ error: '案件が指定されていません' }, { status: 400 })

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const user = userData?.user
    if (uErr || !user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const { data: src } = await db.from('places').select('*').eq('id', placeId).maybeSingle()
    if (!src) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })

    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = me?.role === 'admin'
    const isOwner = src.host_id === user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'この案件を複製する権限がありません' }, { status: 403 })
    }

    const copy: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) {
      if (!SKIP.has(k)) copy[k] = v
    }
    copy.title = String(src.title || '(無題)') + '（コピー）'
    // 中身を直してから公開してもらう
    copy.status = 'draft'
    // 募集者本人が複製したときは、その人の案件として作る
    if (!isAdmin) copy.host_id = user.id

    const { data: created, error } = await db.from('places').insert(copy).select('id, title').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, place: created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
