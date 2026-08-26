import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SiteHeader from '../../components/SiteHeader'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'

export const revalidate = 60

type Post = {
  id: string; slug: string; title: string; content: string
  excerpt: string | null; category: string | null; cover_emoji: string | null
  meta_description: string | null; status: string; published_at: string | null
}

async function getPost(slug: string): Promise<Post | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const sb = createClient(url, key)
  const { data } = await sb.from('posts').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
  return data as Post | null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: '記事が見つかりません | 出店コネクトナビ' }
  const desc = post.meta_description || post.excerpt || post.title
  return {
    title: post.title + ' | 出店コネクトナビ',
    description: desc,
    openGraph: {
      title: post.title,
      description: desc,
      type: 'article',
      publishedTime: post.published_at || undefined,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: desc },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  let html = await marked.parse(post.content)
  html = html.split('<table>').join('<div class="table-wrap"><table>')
  html = html.split('</table>').join('</table></div>')
  const dateStr = post.published_at ? new Date(post.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    datePublished: post.published_at || undefined,
    author: { '@type': 'Organization', name: '出店コネクトナビ' },
    publisher: { '@type': 'Organization', name: '出店コネクトナビ' },
  }

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/blog' />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 60px' }}>
        <Link href="/blog" style={{ fontSize: '13px', color: '#F5A623', textDecoration: 'none', fontWeight: 700 }}>← 記事一覧に戻る</Link>

        <div style={{ marginTop: '20px', marginBottom: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {post.category && <span style={{ background: '#FFF3E0', color: '#B45309', fontSize: '12px', padding: '3px 12px', borderRadius: '999px', fontWeight: 700 }}>{post.category}</span>}
          {dateStr && <span style={{ color: '#94A3B8', fontSize: '12px' }}>{dateStr}</span>}
        </div>

        <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.4, margin: '0 0 28px' }}>
          <span style={{ marginRight: '8px' }}>{post.cover_emoji || '📝'}</span>{post.title}
        </h1>

        <div className="post-body" dangerouslySetInnerHTML={{ __html: html }} />

        <div style={{ marginTop: '48px', padding: '28px', background: 'linear-gradient(135deg, #F5A623, #F9C349)', borderRadius: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>出店場所をお探しですか？</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.95)', marginBottom: '18px' }}>全国の出店場所と出店者をつなぐマッチングサービス。登録は無料です。</div>
          <Link href="/register" style={{ display: 'inline-block', background: '#fff', color: '#B45309', padding: '12px 32px', borderRadius: '999px', fontWeight: 900, textDecoration: 'none', fontSize: '15px' }}>無料で登録する</Link>
        </div>
      </article>

      <SiteFooter />

      <style>{`
        .post-body { font-size: 16px; line-height: 1.9; color: #333; }
        .post-body h1 { font-size: 30px; font-weight: 900; color: #1a1a1a; margin: 56px 0 20px; padding: 0 0 12px; border-bottom: 4px solid #F5A623; }
        .post-body h2 { font-size: 25px; font-weight: 900; color: #1a1a1a; margin: 52px 0 20px; padding: 14px 18px; background: #FFF3E0; border-left: 8px solid #F5A623; border-radius: 0 8px 8px 0; }
        .post-body h3 { font-size: 20px; font-weight: 800; color: #B45309; margin: 36px 0 14px; padding-left: 14px; border-left: 4px solid #F5A623; }
        .post-body p { margin: 0 0 18px; }
        .post-body ul, .post-body ol { margin: 0 0 18px; padding-left: 24px; }
        .post-body li { margin-bottom: 8px; }
        .post-body strong { color: #B45309; font-weight: 700; }
        .post-body a { color: #F5A623; }
        .table-wrap { overflow-x: auto; margin: 20px 0; -webkit-overflow-scrolling: touch; } .post-body table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 480px; }
        .post-body th, .post-body td { border: 1px solid #E2E8F0; padding: 10px 12px; text-align: left; }
        .post-body th { background: #FFF8F0; font-weight: 700; }
        .post-body blockquote { border-left: 4px solid #F5A623; background: #FFF8F0; margin: 20px 0; padding: 12px 20px; border-radius: 0 8px 8px 0; }
        .post-body hr { border: none; border-top: 1px solid #E2E8F0; margin: 32px 0; }
        .post-body code { background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
      `}</style>
    </div>
  )
}