import { NextResponse } from 'next/server'
import { getAdminClient, requireAdmin } from '../../lib/apiAuth'
import { pickPublishedAt, visiblePostsFilter } from '../../lib/postSchedule'

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
      // 公開日が未来の記事（予約中）は、公開日が来るまで返さない（app/lib/postSchedule.ts）
      .or(visiblePostsFilter(new Date().toISOString()))
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
    // 予約中の記事は出さない
    .or(visiblePostsFilter(new Date().toISOString()))
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
    const { slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword, related_prefecture, related_category, published_at } = body

    if (!slug || !title || !content) {
      return NextResponse.json({ error: 'slug・title・content は必須です' }, { status: 400 })
    }

    const now = new Date().toISOString()
    // 公開日は運営が指定できる。
    //
    // まとめて何本も書いた日に全部が同じ日付になると、記事一覧も検索結果も
    // 同日に並ぶ。1日1本ずつ公開しているように見せたいので、
    // 管理画面から日付を指定できるようにしてある（指定が無ければ保存した時刻）。
    // 未来の日付なら予約公開になる（公開日まで公開側に出ない。app/lib/postSchedule.ts）。
    // 読めない日付・上限を超えた日付は、黙って「今」にせず断る（今すぐ公開されてしまうため）
    const picked = pickPublishedAt(published_at, now)
    if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 })
    const wanted = picked.iso
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
        published_at: status === 'published' ? (wanted || now) : null,
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
    const { id, slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword, related_prefecture, related_category, published_at } = body

    if (!id) return NextResponse.json({ error: 'id がありません' }, { status: 400 })

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { slug, title, content, excerpt, category, cover_emoji, meta_description, status, target_keyword: target_keyword || null, related_prefecture: related_prefecture || null, related_category: related_category || null, updated_at: now }
    if (status === 'published') {
      // 運営が日付を指定していればそれに従う（1日1本ずつに見せるため）。
      // 指定が無いときは、これまでどおり「まだ公開日が無い記事だけ」今の時刻を入れる。
      // 未来の日付なら予約公開になる
      const picked = pickPublishedAt(published_at, now)
      if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 })
      const wanted = picked.iso
      if (wanted) {
        updates.published_at = wanted
      } else {
        const { data: cur } = await admin.from('posts').select('published_at').eq('id', id).maybeSingle()
        if (cur && !cur.published_at) updates.published_at = now
      }
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