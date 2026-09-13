import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SiteHeader from '../../components/SiteHeader'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'
import PostCta from '../../components/PostCta'
import JsonLd from '../../components/JsonLd'
import { SITE_URL, ORG, OG_DEFAULT_IMAGE, breadcrumbJsonLd } from '../../lib/seo'
import { firstImage } from '../../lib/postImage'
import { preparePostBody, extractFaq, boldForJapanese } from '../../lib/postBody'
import { POST_IMAGE_SIZES } from '../../lib/postImageSizes'
import RelatedPlaces, { fetchRelatedPlaces } from '../../components/RelatedPlaces'

export const revalidate = 60

// 空の配列を返すと、ビルド時には1本も作らず、初めて開かれたときに作ってキャッシュし、
// 60秒ごとに作り直す（ISR）。これが無いと revalidate を書いていても
// 毎回その場で描画していた（2026-09-13 に本番のヘッダーで確認）。
// Next 16 の仕様: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md
export async function generateStaticParams() {
  return []
}

type Post = {
  id: string; slug: string; title: string; content: string
  excerpt: string | null; category: string | null; cover_emoji: string | null
  meta_description: string | null; status: string; published_at: string | null
  updated_at: string | null
  // 20260901_post_seo_columns.sql で追加。未適用の環境では undefined になる
  target_keyword?: string | null
  related_prefecture?: string | null
  related_category?: string | null
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
  if (!post) {
    return { title: { absolute: '記事が見つかりません - 出店コネクトナビ' }, robots: { index: false, follow: true } }
  }
  const desc = post.meta_description || post.excerpt || post.title
  const image = firstImage(post.content)
  return {
    // layout の template が二重に付かないよう absolute で指定する
    title: { absolute: `${post.title} - 出店コネクトナビ` },
    description: desc,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: desc,
      type: 'article',
      url: `/blog/${post.slug}`,
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at || undefined,
      images: [image ?? OG_DEFAULT_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: desc, images: [image ?? OG_DEFAULT_IMAGE] },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  // 日本語の太字が崩れないよう、先に <strong> にしてから変換する（postBody.ts）
  let raw = await marked.parse(boldForJapanese(post.content))
  raw = raw.split('<table>').join('<div class="table-wrap"><table>')
  raw = raw.split('</table>').join('</table></div>')
  // 本文中の h1 を h2 に落とし、h2 に id を振って目次を作る
  const { html, toc } = preparePostBody(raw, POST_IMAGE_SIZES)
  // 本文に「よくある質問」があるときだけ FAQPage を出す
  const faq = extractFaq(html)
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
  const dateStr = post.published_at ? fmtDate(post.published_at) : ''
  // 書き直した記事は、公開日だけだと古い情報に見える。
  // 構造化データの dateModified と画面の表示を揃えるため、日付が違うときは更新日も出す
  const updatedStr = post.updated_at ? fmtDate(post.updated_at) : ''
  const showUpdated = !!updatedStr && updatedStr !== dateStr
  const image = firstImage(post.content)

  // 記事に設定した都道府県・カテゴリに合う案件を4件だけ引く
  const related = await fetchRelatedPlaces(post.related_prefecture ?? null, post.related_category ?? null, 4)
  // 都道府県の案件が足りないと、ほかの県の案件で枠を埋める（RelatedPlaces.tsx）。
  // そのときに「兵庫県でいま募集している場所」と書くと中身と合わないので、
  // 並んだ案件がすべてその県のときだけ県名を出す
  const allInPref = !!post.related_prefecture && related.length > 0
    && related.every(p => p.prefecture === post.related_prefecture)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    image: image ? [image] : undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
    author: { '@type': 'Organization', name: ORG.name, url: SITE_URL },
    publisher: { '@type': 'Organization', name: ORG.name, url: SITE_URL },
  }

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/blog' />
      </div>
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', path: '/' },
          { name: 'お役立ち情報', path: '/blog' },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      {faq.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(f => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          }}
        />
      )}

      <article style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 60px' }}>
        <nav aria-label='パンくず' style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
          <Link href='/' style={{ color: '#94A3B8', textDecoration: 'none' }}>ホーム</Link>
          {' › '}
          <Link href='/blog' style={{ color: '#94A3B8', textDecoration: 'none' }}>お役立ち情報</Link>
          {' › '}
          <span>{post.title}</span>
        </nav>

        <div style={{ marginTop: '20px', marginBottom: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {post.category && <span style={{ background: '#FFF3E0', color: '#B45309', fontSize: '12px', padding: '3px 12px', borderRadius: '999px', fontWeight: 700 }}>{post.category}</span>}
          {dateStr && <span style={{ color: '#94A3B8', fontSize: '12px' }}>{showUpdated ? `公開 ${dateStr}` : dateStr}</span>}
          {showUpdated && <span style={{ color: '#94A3B8', fontSize: '12px' }}>更新 {updatedStr}</span>}
        </div>

        {/* 記事タイトルはスマホで3行前後に折り返るため、jp-head で文節の切れ目に寄せる。
            タイトルはデータベース由来で .u の区切りを入れられないため、
            word-break: auto-phrase に対応するブラウザ（Android の Chrome など）でだけ効く。
            iPhone の Safari では従来どおりの折り返しのままになる */}
        {/* 絵文字は飾りなので h1 の外に置く。h1 の中にあると、見出しの文字が
            「🏢記事タイトル」になり、title と一致しなくなる */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0 0 28px' }}>
          <span aria-hidden='true' style={{ fontSize: 'clamp(24px, 4vw, 34px)', lineHeight: 1.4, flex: '0 0 auto' }}>{post.cover_emoji || '📝'}</span>
          <h1 className='jp-head' style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.4, margin: 0 }}>
            {post.title}
          </h1>
        </div>

        {toc.length >= 2 && (
          <nav aria-label='目次' style={{ background: '#fff', border: '1px solid #F0E3D0', borderRadius: '12px', padding: '18px 20px', marginBottom: '32px' }}>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#B45309', marginBottom: '10px' }}>目次</div>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: 2 }}>
              {toc.map(t => (
                <li key={t.id}>
                  <a href={`#${t.id}`} style={{ color: '#333', textDecoration: 'none' }}>{t.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="post-body" dangerouslySetInnerHTML={{ __html: html }} />

        <RelatedPlaces
          places={related}
          lead={
            // 募集者向けの記事に来た人は、出店する場所を探してはいない。
            // 枠は内部リンクとして残しつつ、
            // 「どんな場所で実際に動いているか」の例として見せる
            post.category === '募集者向け'
              ? (allInPref
                  ? `${post.related_prefecture}でいま募集している場所の例です。`
                  : 'いま実際に募集している場所の例です。')
              : (allInPref
                  ? `${post.related_prefecture}で募集中の出店場所です。`
                  : 'いま募集中の出店場所です。')
          }
        />

        <PostCta category={post.category} />
      </article>

      <SiteFooter />

      <style>{`
        .post-body { font-size: 16px; line-height: 1.9; color: #333; }
        .post-body h1 { font-size: 30px; font-weight: 900; color: #1a1a1a; margin: 56px 0 20px; padding: 0 0 12px; border-bottom: 4px solid #F5A623; }
        .post-body h2 { scroll-margin-top: 90px; font-size: 25px; font-weight: 900; color: #1a1a1a; margin: 52px 0 20px; padding: 14px 18px; background: #FFF3E0; border-left: 8px solid #F5A623; border-radius: 0 8px 8px 0; }
        .post-body h3 { font-size: 20px; font-weight: 800; color: #B45309; margin: 36px 0 14px; padding-left: 14px; border-left: 4px solid #F5A623; }
        .post-body p { margin: 0 0 18px; }
        .post-body img { width: 100%; height: auto; border-radius: 10px; }
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
        @media (max-width: 560px) { .related-places-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}