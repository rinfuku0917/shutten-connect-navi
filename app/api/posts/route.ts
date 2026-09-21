import { NextResponse } from 'next/server'
import { getAdminClient, requireAdmin } from '../../lib/apiAuth'

// ブログ記事の読み書き。書き込み（POST/PUT/DELETE）は運営だけ。
//
// 以前は body の requesterId を profiles.role='admin' と照合するだけで、
// Authorization ヘッダを見ていなかった。運営のUUIDを知られていれば、
// ログインせずに公開記事の投稿・差し替え・削除ができる状態だった。
// 誰として呼んでいるかはアクセストークンだけで決める（app/lib/apiAuth.ts）。

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
    // 下書き（status≠published）まで含めて返す分岐なので、運営だけに通す。
    // 書き込みだけ塞いでも、ここが空いていれば未公開の記事の本文・
    // meta_description・target_keyword が誰にでも読めてしまう
    // （運営のUUIDさえ要らないので、塞いだ経路より条件がゆるい）
    const auth = await requireAdmin(req, admin)
    if (auth instanceof NextResponse) return auth

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
    .order('slug', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function POST(req: Request) {
  try {
    // 入力の検査より先に運営かどうかを見る。
    // 運営でない相手に「slug は必須です」などと返すと、当たり外れを教えることになる
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const admin = auth.db

    const body = await req.json()
    const { slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword, related_prefecture, related_category } = body

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
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const admin = auth.db

    const body = await req.json()
    const { id, slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword, related_prefecture, related_category } = body

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
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const admin = auth.db

    const body = await req.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'id がありません' }, { status: 400 })

    const { error } = await admin.from('posts').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}