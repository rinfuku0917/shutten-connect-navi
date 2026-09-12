import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteHeader from '../../../components/SiteHeader'
import SiteFooter from '../../../components/SiteFooter'
import BackButton from '../../../components/BackButton'
import PostCard, { type PostCardData } from '../../../components/PostCard'

// キッチンカーを呼びたい方（募集者）向けの記事をまとめた入口。
//
// なぜ固有のURLで作るか:
//   これまで分類での絞り込みは /blog?category=募集者向け という形しかなく、
//   正規URLはすべて /blog を指していた。つまり募集者向けの記事を
//   まとめた入口が、検索の対象として存在していなかった。
//   AGENTS.md のSEOルールも「クエリパラメータだけの出し分けは不可」と
//   定めている。
//
// なぜ「募集者向け」の1枚だけ作るか:
//   4つの分類を一度に作ると、固有の文章が書けないページが3枚増える。
//   薄いページを増やさない方針（docs/seo-keywords.md）に反する。
//   いま増やしたいのは呼びたい側なので、ここから始める。

const CATEGORY = '募集者向け'

export const metadata: Metadata = {
  // AGENTS.md の形式「{ページ名} - 出店コネクトナビ」
  title: { absolute: 'キッチンカーを呼びたい方へ｜手配と費用の記事一覧 - 出店コネクトナビ' },
  description:
    'イベント・商業施設・オフィス・学校へキッチンカーを呼びたい方向けの記事をまとめました。呼び方の手順、費用の相場、無料で呼べる条件、駐車場や空きスペースの活用まで、実際の募集データをもとに解説しています。',
  // 正規URLは自ページ。layout の指定を継いでトップを指さないようにする
  alternates: { canonical: '/blog/category/host' },
  openGraph: {
    title: 'キッチンカーを呼びたい方へ｜手配と費用の記事一覧',
    description: 'イベント・商業施設・オフィス・学校へキッチンカーを呼びたい方向けの記事。呼び方、費用、無料で呼べる条件を実データで解説。',
    url: '/blog/category/host',
    type: 'website',
  },
}

// 1時間ごとに作り直す。記事の公開はそう頻繁ではない
export const revalidate = 3600

async function getPosts(): Promise<PostCardData[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const sb = createClient(url, key)
  const { data } = await sb
    .from('posts')
    .select('id, slug, title, excerpt, category, cover_emoji, published_at, content')
    .eq('status', 'published')
    .eq('category', CATEGORY)
    .order('published_at', { ascending: false })
  return (data || []) as PostCardData[]
}

export default async function HostCategoryPage() {
  const posts = await getPosts()

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6' }}>
      <SiteHeader />
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/vendor' />
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* パンくず。この一覧がサイトのどこに属するかを示す */}
        <nav aria-label='パンくず' style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '14px' }}>
          <Link href='/' style={{ color: '#94A3B8', textDecoration: 'none' }}>ホーム</Link>
          {' › '}
          <Link href='/blog' style={{ color: '#94A3B8', textDecoration: 'none' }}>お役立ち情報</Link>
          {' › '}
          <span style={{ color: '#64748B' }}>キッチンカーを呼びたい方へ</span>
        </nav>

        <h1 className='jp-head' style={{ fontSize: 'clamp(21px,5.4vw,28px)', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.5, marginBottom: '14px' }}>
          キッチンカーを呼びたい方へ
        </h1>

        {/* この一覧だけの導入文。分類の絞り込みを固有URLにしただけでは、
            中身が /blog と同じページになってしまう */}
        <p className='jp-text' style={{ fontSize: '14.5px', color: '#475569', lineHeight: 1.95, marginBottom: '16px' }}>
          イベント、商業施設の空きスペース、オフィスの昼食提供、学校行事、マンションの住民向けの催し。
          キッチンカーを呼ぶ場面はさまざまですが、決めることはおおむね共通しています。
          何台呼ぶか、費用をどちらが負担するか、当日どう進めるか。
        </p>
        <p className='jp-text' style={{ fontSize: '14.5px', color: '#475569', lineHeight: 1.95, marginBottom: '26px' }}>
          ここでは、実際の募集データをもとにした記事をまとめています。
          相場の目安、主催者の持ち出しが0円になる条件、依頼のときに伝える項目など、
          初めて呼ぶ方が迷いやすいところから順に読めます。
          お急ぎの場合は
          <Link href='/vendor' style={{ color: '#B45309', fontWeight: 700 }}>キッチンカーの手配・派遣</Link>
          から直接ご相談いただけます（会員登録は不要です）。
        </p>

        {/* 先に進みたい方の導線。記事を読まずに相談したい方が多い */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '30px' }}>
          <Link href='/vendor#soudan' style={{ background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '14px', padding: '12px 24px', borderRadius: '999px', textDecoration: 'none', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}>
            出店の相談をする
          </Link>
          <Link href='/vendor/cost' style={{ background: '#fff', color: '#B45309', fontWeight: 800, fontSize: '14px', border: '1.5px solid #F5D9A8', padding: '12px 22px', borderRadius: '999px', textDecoration: 'none', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}>
            費用の目安を見る
          </Link>
        </div>

        <h2 className='jp-head' style={{ fontSize: '18px', fontWeight: 900, color: '#1a1a1a', marginBottom: '14px' }}>
          記事一覧（{posts.length}本）
        </h2>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999', fontSize: '14px' }}>
            記事を準備中です。
            <br />
            <Link href='/vendor' style={{ color: '#B45309', fontWeight: 700 }}>キッチンカーの手配・派遣</Link>
            からご相談いただけます。
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}

        {/* 出店する側の一覧へも繋ぐ。読者を取り違えて来た方の行き先 */}
        <div style={{ marginTop: '34px', paddingTop: '20px', borderTop: '1px solid #E7DCC8' }}>
          <div className='jp-text' style={{ fontSize: '13.5px', color: '#64748B', lineHeight: 1.9 }}>
            キッチンカーで<strong>出店したい</strong>方は
            <Link href='/blog' style={{ color: '#B45309', fontWeight: 700 }}>お役立ち情報</Link>
            に開業・許可・出店場所の探し方の記事があります。
            出店できる場所は
            <Link href='/places' style={{ color: '#B45309', fontWeight: 700 }}>出店場所をさがす</Link>
            からご覧いただけます。
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
