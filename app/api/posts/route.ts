import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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

export async function GET(req: Request) {
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const all = searchParams.get('all')

  if (slug) {
    const { data, error } = await admin
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ post: data })
  }

  if (all) {
    const { data, error } = await admin
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data })
  }

  const { data, error } = await admin
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(req: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    const body = await req.json()
    const { requesterId, slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword, related_prefecture, related_category } = body

    if (!requesterId) return NextResponse.json({ error: '認証情報がありません' }, { status: 401 })
    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }
    if (!slug || !title || !content) {
      return NextResponse.json({ error: 'slug・title・content は必須です' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data, error } = await admin
      .from('posts')
      .insert({
        slug, title, content,
        excerpt: excerpt || null,
        category: category || null,
        cover_emoji: cover_emoji || '📝',
        meta_description: meta_description || null,
        // SEO用（20260901_post_seo_columns.sql で追加）
        target_keyword: target_keyword || null,
        related_prefecture: related_prefecture || null,
        related_category: related_category || null,
        status: status || 'draft',
        published_at: status === 'published' ? now : null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'このURL（slug）は既に使われています' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, post: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    const body = await req.json()
    const { requesterId, id, slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword, related_prefecture, related_category } = body

    if (!requesterId) return NextResponse.json({ error: '認証情報がありません' }, { status: 401 })
    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }
    if (!id) return NextResponse.json({ error: 'id がありません' }, { status: 400 })

    const updates: Record<string, unknown> = { slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword: target_keyword || null, related_prefecture: related_prefecture || null, related_category: related_category || null, updated_at: new Date().toISOString() }
    if (status === 'published') {
      const { data: cur } = await admin.from('posts').select('published_at').eq('id', id).maybeSingle()
      if (cur && !cur.published_at) updates.published_at = new Date().toISOString()
    }

    const { data, error } = await admin.from('posts').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, post: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    const body = await req.json()
    const { requesterId, id } = body

    if (!requesterId) return NextResponse.json({ error: '認証情報がありません' }, { status: 401 })
    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }
    if (!id) return NextResponse.json({ error: 'id がありません' }, { status: 400 })

    const { error } = await admin.from('posts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}