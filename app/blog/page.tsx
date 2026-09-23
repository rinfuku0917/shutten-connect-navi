import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import type { Metadata } from 'next'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import PostCard from '../components/PostCard'
import { POST_CATEGORIES } from '../lib/postCategories'
import { MERGED_SLUGS_FILTER } from '../lib/mergedPosts'
import { visiblePostsFilter } from '../lib/postSchedule'

export const revalidate = 60

// ★このページは searchParams（?page= / ?category=）を読まない。
//
// 読むと Next はこのページを「動的描画」に切り替え、revalidate を宣言しても
// ISR も CDN キャッシュも効かなくなる。実測（2026-09-23）では TTFB 0.95〜1.0秒・
// x-vercel-cache が毎回 MISS だった（固有ページの /blog/category/host は 0.38秒・HIT）。
//
// そこでページ送りと分類の絞り込みをやめ、公開済みの記事を1枚のページに
// 分類ごとに並べる。記事は26本（予約分を含めて33本）なので1ページで足りる。
//   ・分類のボタンはページ内の見出しへの移動にした（クエリのURLを増やさない）
//   ・すべての記事が /blog から1クリックで見える（以前は11本目以降が
//     ?page=2 の奥にあり、クローラーの発見経路が細かった）
//   ・?page=2 や ?category=◯◯ を開いても200で同じ一覧が出る。
//     canonical は /blog を指すので、重複としてまとめられる
//     （AGENTS.md「クエリパラメータだけの出し分けは不可」）
const description = 'キッチンカー・屋台の開業や出店に役立つ情報をお届けします。開業費用、営業許可、出店場所の探し方、収益アップのコツなど、出店者と募集者のための実践ガイド。'

export const metadata: Metadata = {
  // layout の template が二重に付かないよう absolute で指定する
  title: { absolute: 'お役立ち情報 - 出店コネクトナビ' },
  description,
  alternates: { canonical: '/blog' },
}

// 分類ごとの見出しに付けるid（ページ内リンク先）。日本語のidは使わない
const CATEGORY_ANCHOR: Record<string, string> = {
  '出店場所の探し方': 'find',
  '開業・許可': 'start',
  '書類・保険': 'docs',
  '募集者向け': 'host',
}

const PILL = { padding: '9px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 800, textDecoration: 'none', border: '1px solid #E7DCC8', background: '#fff', color: '#64748B' } as const

type Post = {
  id: string; slug: string; title: string
  excerpt: string | null; category: string | null; cover_emoji: string | null; content: string
  published_at: string | null
}

async function getPosts(): Promise<Post[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const sb = createClient(url, key)
  const { data } = await sb.from('posts').select('id, slug, title, excerpt, category, cover_emoji, published_at, content')
    .eq('status', 'published')
    // 公開日が未来の記事（予約中）は、公開日が来るまで出さない（app/lib/postSchedule.ts）
    .or(visiblePostsFilter(new Date().toISOString()))
    // 別の記事に統合したものは出さない。公開に戻っていても一覧には並べない
    .not('slug', 'in', MERGED_SLUGS_FILTER)
    .order('published_at', { ascending: false })
    // 同じ日時に公開した記事の並びを固定する（毎回順が変わるとキャッシュが無駄に変わる）
    .order('slug', { ascending: true })
  return (data as Post[]) || []
}

export default async function BlogPage() {
  const posts = await getPosts()

  // 分類ごとに分ける。決めた4カテゴリ以外（未設定・古い分類）は「そのほか」に入れる。
  // 記事が1本も無い分類は節ごと出さない
  const groups = POST_CATEGORIES
    .map(c => ({ name: c as string, anchor: CATEGORY_ANCHOR[c], posts: posts.filter(p => p.category === c) }))
    .concat([{
      name: 'そのほか',
      anchor: 'other',
      posts: posts.filter(p => !POST_CATEGORIES.includes((p.category ?? '') as (typeof POST_CATEGORIES)[number])),
    }])
    .filter(g => g.posts.length > 0)

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>
      <div style={{ background: 'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-blog.webp) center/cover no-repeat', padding: '80px 24px', textAlign: 'center', minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#fff', marginBottom: '8px', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>お役立ち情報</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>出店に役立つ記事・ガイドをお届けします</p>
      </div>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px' }}>
        {/* 分類のボタンは、同じページの見出しへ移動する（クエリのURLを増やさない）。
            「募集者向け」だけは固有のURLを持つページがあるので、そちらへ送る */}
        <nav aria-label='記事のカテゴリー' style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
          {groups.map(g => (
            g.anchor === 'host'
              ? <Link key={g.anchor} href='/blog/category/host' style={PILL}>{g.name}</Link>
              : <a key={g.anchor} href={`#${g.anchor}`} style={PILL}>{g.name}</a>
          ))}
        </nav>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', fontSize: '14px' }}>記事を準備中です。もうしばらくお待ちください。</div>
        ) : (
          groups.map(g => (
            <section key={g.anchor} id={g.anchor} style={{ marginBottom: '36px', scrollMarginTop: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#1a1a1a', margin: '0 0 14px' }}>
                {g.name}
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', marginLeft: '8px' }}>{g.posts.length}本</span>
              </h2>
              <div style={{ display: 'grid', gap: '16px' }}>
                {g.posts.map(post => <PostCard key={post.id} post={post} />)}
              </div>
              {g.anchor === 'host' && (
                <p style={{ margin: '14px 0 0', fontSize: '13px' }}>
                  <Link href='/blog/category/host' style={{ color: '#B45309', fontWeight: 700 }}>募集者向けの記事まとめを見る →</Link>
                </p>
              )}
            </section>
          ))
        )}
      </div>
      <SiteFooter />
    </div>
  )
}