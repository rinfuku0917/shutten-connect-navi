import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import type { Metadata } from 'next'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import { firstImage, thumbnailUrl } from '../lib/postImage'
import { POST_CATEGORIES } from '../lib/postCategories'

export const revalidate = 60

export const metadata: Metadata = {
  // layout の template が二重に付かないよう absolute で指定する
  title: { absolute: 'お役立ち情報 - 出店コネクトナビ' },
  description: 'キッチンカー・屋台の開業や出店に役立つ情報をお届けします。開業費用、営業許可、出店場所の探し方、収益アップのコツなど、出店者と募集者のための実践ガイド。',
  alternates: { canonical: '/blog' },
}

type Post = {
  id: string; slug: string; title: string
  excerpt: string | null; category: string | null; cover_emoji: string | null; content: string
  published_at: string | null
}

const PER_PAGE = 10

async function getPosts(page: number, category: string | null): Promise<{ posts: Post[]; total: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { posts: [], total: 0 }
  const sb = createClient(url, key)
  const start = (page - 1) * PER_PAGE
  const end = start + PER_PAGE - 1
  let q = sb.from('posts').select('id, slug, title, excerpt, category, cover_emoji, published_at, content', { count: 'exact' }).eq('status', 'published')
  // 絞り込みはサーバー側で行う（クライアントで絞ると、その分もHTMLに出ないため）
  if (category) q = q.eq('category', category)
  const { data, count } = await q.order('published_at', { ascending: false }).range(start, end)
  return { posts: (data as Post[]) || [], total: count || 0 }
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string; category?: string }> }) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  // 決めた4カテゴリ以外が来ても無視する
  const category = POST_CATEGORIES.includes((sp.category ?? '') as (typeof POST_CATEGORIES)[number]) ? sp.category! : null
  const { posts, total } = await getPosts(page, category)
  const totalPages = Math.ceil(total / PER_PAGE)
  const qs = (over: Record<string, string | number | null>) => {
    const q = new URLSearchParams()
    const c = 'category' in over ? over.category : category
    const pg = 'page' in over ? over.page : page
    if (c) q.set('category', String(c))
    if (pg && Number(pg) > 1) q.set('page', String(pg))
    const t = q.toString()
    return t ? `/blog?${t}` : '/blog'
  }

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
        <nav aria-label='記事のカテゴリー' style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <Link
            href={qs({ category: null, page: 1 })}
            style={{ padding: '9px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 800, textDecoration: 'none', border: '1px solid ' + (category ? '#E7DCC8' : '#F5A623'), background: category ? '#fff' : '#F5A623', color: category ? '#64748B' : '#fff' }}
          >
            すべて
          </Link>
          {POST_CATEGORIES.map(c => (
            <Link
              key={c}
              href={qs({ category: c, page: 1 })}
              style={{ padding: '9px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 800, textDecoration: 'none', border: '1px solid ' + (category === c ? '#F5A623' : '#E7DCC8'), background: category === c ? '#F5A623' : '#fff', color: category === c ? '#fff' : '#64748B' }}
            >
              {c}
            </Link>
          ))}
        </nav>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', fontSize: '14px' }}>{category ? `「${category}」の記事はまだありません。` : '記事を準備中です。もうしばらくお待ちください。'}</div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {posts.map(post => (
              <Link key={post.id} href={'/blog/' + post.slug} style={{ textDecoration: 'none', display: 'block', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', color: 'inherit' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {(() => {
                    const img = firstImage(post.content)
                    return img
                      ? <img src={thumbnailUrl(img)} alt="" width={96} height={96} loading="lazy" decoding="async" style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
                      : <div style={{ fontSize: '40px', flexShrink: 0 }}>{post.cover_emoji || '📝'}</div>
                  })()}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {post.category && <span style={{ background: '#FFF3E0', color: '#B45309', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{post.category}</span>}
                      {post.published_at && <span style={{ color: '#94A3B8', fontSize: '11px' }}>{new Date(post.published_at).toLocaleDateString('ja-JP')}</span>}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.5 }}>{post.title}</div>
                    {post.excerpt && <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.6 }}>{post.excerpt}</div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '32px', flexWrap: 'wrap' }}>
            {page > 1 && (
              <a href={qs({ page: page - 1 })} style={{ padding: '8px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#1a1a1a', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>← 前へ</a>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <a key={n} href={qs({ page: n })} style={{ padding: '8px 14px', border: n === page ? '1px solid #F5A623' : '1px solid #e0e0e0', borderRadius: '8px', background: n === page ? '#F5A623' : '#fff', color: n === page ? '#fff' : '#1a1a1a', textDecoration: 'none', fontSize: '13px', fontWeight: 700, minWidth: '20px', textAlign: 'center' }}>{n}</a>
            ))}
            {page < totalPages && (
              <a href={qs({ page: page + 1 })} style={{ padding: '8px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', color: '#1a1a1a', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>次へ →</a>
            )}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}