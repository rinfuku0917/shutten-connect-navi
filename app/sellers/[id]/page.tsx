import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { corporateNameOrEmpty } from '../../lib/sellerNames'
import { isExcludedShop } from '../../lib/excludedShops'
import { createClient } from '@supabase/supabase-js'
import JsonLd from '../../components/JsonLd'
import { SITE_URL, OG_DEFAULT_IMAGE, breadcrumbJsonLd } from '../../lib/seo'
import SellerDetailClient, { type Seller, type MenuItem, type Review, type SnsLink } from './SellerDetailClient'

// 出店者の詳細ページ。
//
// もともと画面全部がブラウザ側で組み立てられており、サーバーが返すHTMLに
// 店舗名もメニューも入っていなかった。1,385ページすべてが「トップと同じ
// タイトル・同じ説明・中身なし」の状態だったため、ここで中身を返すようにした。
//
// 表示そのものは SellerDetailClient に任せ、ここでは
// ・最初に見せるデータを取る
// ・タイトルと説明（generateMetadata）を作る
// ・構造化データを出す
// だけを行う。レビュー投稿などの操作はこれまでどおりブラウザ側で動く。

export const revalidate = 600

// 一覧に出さない運営用のアカウント（出店者一覧と同じ扱い）
// 隠す屋号は app/lib/excludedShops.ts が唯一の正

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// 承認済みの出店者だけを返す。
// サービスロールキーは行single制御(RLS)を通り抜けるため、承認状態の条件は
// ここで必ず自分で書くこと。書き忘れると未承認の情報が公開されてしまう。
async function fetchSeller(id: string): Promise<Seller | null> {
  const db = client()
  if (!db) return null
  const { data } = await db
    .from('profiles')
    // name は「氏名の欄に入っている会社名」を出すためだけに読む。
    // 個人名はページに出さない（下の displayName が corporateNameOrEmpty を通す）
    .select('id, name, shop_name, genre, areas, photos, bio, sales_type, vehicle_type, size_length, size_width, size_height, equipment, menu, takeout_bag, payment_methods')
    .eq('id', id)
    .eq('role', 'seller')
    .eq('approval_status', 'approved')
    .maybeSingle()
  return (data as Seller) ?? null
}

// 出店者の行そのものがあるか（承認状態は問わない）。
//
// 未承認の出店者は、運営や本人が ?preview=1 でブラウザ側から見られるように
// 404 にしていない。そのせいで存在しないIDでも200を返し、ソフト404になっていた。
// 行が本当に無いときだけ404を返す。中身は返さないので、未承認の情報は漏れない。
// 読めなかったときは「ある」とみなす（本物のページを404にしないため）。
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function sellerExists(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false
  const db = client()
  if (!db) return true
  const { data, error } = await db.from('profiles').select('id').eq('id', id).eq('role', 'seller').maybeSingle()
  if (error) return true
  return !!data
}

async function fetchMenusAndReviews(id: string): Promise<{ menus: MenuItem[]; reviews: Review[]; sns: SnsLink[] }> {
  const db = client()
  if (!db) return { menus: [], reviews: [], sns: [] }
  const [{ data: menus }, { data: reviews }, { data: sns }] = await Promise.all([
    // detail はトッピングや内容量の補足（例「2本」「ミルク・ソーダ選べます」）
    db.from('menus').select('id, name, price, photo_url, sort_order, detail').eq('seller_id', id)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    db.from('reviews').select('id, reviewer_name, rating, comment, created_at').eq('seller_id', id)
      .eq('status', 'approved').order('created_at', { ascending: false }),
    db.from('sns_links').select('platform, url').eq('seller_id', id),
  ])
  return {
    menus: (menus as MenuItem[]) ?? [],
    reviews: (reviews as Review[]) ?? [],
    sns: ((sns as SnsLink[]) ?? []).filter(x => x.url),
  }
}

// genre は文字列の配列だったり、配列を文字列にしたものだったりする
function toArray(v: string[] | string | null): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  const t = v.trim()
  if (t.startsWith('[') && t.endsWith(']')) {
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean)
    } catch { /* 文字列のまま扱う */ }
  }
  return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
}

// 公開ページに出す名前。
//
// **本名（個人名）は出さない。**
// 以前は屋号が空のときに profiles.name で埋めていたため、屋号を入れていない
// 出店者304人の本名が、ページのタイトル・見出し・説明文・構造化データに出ていた
// （2026-09-19 に出店者ご本人から申し出があった）。
//
// 2026-09-24 に運営の判断で、氏名の欄に入っている「会社名」だけは出すことにした
// （会社名は個人情報ではない。一覧が「（店名未登録）」ばかりになるのを減らす）。
// 会社名かどうかの判定は app/lib/sellerNames.ts の corporateNameOrEmpty が唯一の正で、
// 一覧（app/sellers/page.tsx）とサイトマップも同じ関数を読む。
// どちらも無い場合は一般的な言い方にし、あわせて検索には出さない（下の noindex）。
const NO_SHOP_NAME = 'キッチンカー出店者'

function shopNameOf(s: Seller): string {
  return (s.shop_name ?? '').trim() || corporateNameOrEmpty((s as { name?: string | null }).name)
}

function displayName(s: Seller): string {
  return shopNameOf(s) || NO_SHOP_NAME
}

/** ブラウザへ渡す形に直す。
 *
 *  fetchSeller は氏名（profiles.name）も読む（会社名を出すため）。
 *  そのまま渡すと、ページのHTMLに氏名が載ってしまう（個人名も含めて）。
 *  shop_name に「出してよい名前」を入れ、氏名の列は落としてから渡す。
 *  こうするとブラウザ側の部品は今までどおり shop_name を見るだけでよい。 */
function sellerForBrowser(s: Seller): Seller {
  const { name: _dropped, ...rest } = s as Seller & { name?: string | null }
  void _dropped
  return { ...rest, shop_name: shopNameOf(s) || null } as Seller
}

// 検索結果に出す説明文。120字前後に収める。
//
// 出店者が紹介文（bio）を書いていれば、それを使う。
// 以前は必ず下の定型文を組み立てていたため、1,300を超えるページの
// 説明文がほぼ同じ形になっていた。本人の言葉があるならそちらが良い。
function summarize(s: Seller, menus: MenuItem[]): string {
  const name = displayName(s)
  const bio = (s.bio ?? '').replace(/\s+/g, ' ').trim()
  if (bio.length >= 30) {
    const head = `${name}｜`
    const body = bio.length + head.length > 120 ? bio.slice(0, 119 - head.length) + '…' : bio
    return head + body
  }
  const genres = toArray(s.genre)
  const areas = (s.areas ?? []).map(x => String(x).trim()).filter(Boolean)
  const parts: string[] = [`${name}のプロフィールです。`]
  if (genres.length > 0) parts.push(`ジャンルは${genres.slice(0, 3).join('・')}。`)
  if (areas.length > 0) parts.push(`${areas.slice(0, 4).join('・')}での出店に対応しています。`)
  if (menus.length > 0) parts.push(`メニュー：${menus.slice(0, 3).map(m => m.name).join('・')}など。`)
  parts.push('イベントや施設への出店をご依頼いただけます。')
  const text = parts.join('')
  return text.length > 120 ? text.slice(0, 119) + '…' : text
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const seller = await fetchSeller(id)
  if (!seller) {
    return { title: { absolute: '出店者が見つかりません - 出店コネクトナビ' }, robots: { index: false, follow: true } }
  }
  const name = displayName(seller)
  // 運営用アカウントは検索結果に出さない
  if (isExcludedShop(name)) {
    return { title: { absolute: `${name} - 出店コネクトナビ` }, robots: { index: false, follow: true } }
  }
  const { menus } = await fetchMenusAndReviews(id)
  const description = summarize(seller, menus)
  // 屋号が無いページは、誰の紹介なのかが分からないまま検索に出ることになる。
  // 本名を出さない代わりに、検索にも出さない（サイトマップと一覧からも外す）
  const noShopName = !shopNameOf(seller)
  const photo = seller.photos && seller.photos.length > 0 ? seller.photos[0] : null

  return {
    title: { absolute: `${name}｜キッチンカー・出店者情報 - 出店コネクトナビ` },
    description,
    ...(noShopName ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/sellers/${seller.id}` },
    openGraph: {
      title: `${name}｜キッチンカー・出店者情報`,
      description,
      url: `/sellers/${seller.id}`,
      type: 'profile',
      images: [photo ?? OG_DEFAULT_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: name, description, images: [photo ?? OG_DEFAULT_IMAGE] },
  }
}

export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const seller = await fetchSeller(id)
  // 行そのものが無いIDは404にする（ソフト404を出さない）
  if (!seller && !(await sellerExists(id))) notFound()
  const { menus, reviews, sns } = seller ? await fetchMenusAndReviews(id) : { menus: [], reviews: [], sns: [] }

  const name = seller ? displayName(seller) : ''
  const genres = seller ? toArray(seller.genre) : []
  const areas = seller ? (seller.areas ?? []).map(x => String(x).trim()).filter(Boolean) : []
  const photo = seller?.photos && seller.photos.length > 0 ? seller.photos[0] : null

  return (
    <>
      {seller && !isExcludedShop(name) && (
        <>
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'FoodEstablishment',
              name,
              url: `${SITE_URL}/sellers/${seller.id}`,
              image: photo ?? undefined,
              servesCuisine: genres.length > 0 ? genres : undefined,
              areaServed: areas.length > 0 ? areas.map(a => ({ '@type': 'AdministrativeArea', name: a })) : undefined,
              hasMenu:
                menus.length > 0
                  ? {
                      '@type': 'Menu',
                      hasMenuItem: menus.slice(0, 30).map(m => ({
                        '@type': 'MenuItem',
                        name: m.name,
                        ...(m.price != null ? { offers: { '@type': 'Offer', price: String(m.price), priceCurrency: 'JPY' } } : {}),
                      })),
                    }
                  : undefined,
            }}
          />
          <JsonLd
            data={breadcrumbJsonLd([
              { name: 'ホーム', path: '/' },
              { name: '出店者一覧', path: '/sellers' },
              { name, path: `/sellers/${seller.id}` },
            ])}
          />
        </>
      )}

      {/* ブラウザへ渡す前に、名前を「出してよい名前」に置き換える。
          fetchSeller は氏名（profiles.name）も読むが、それをそのまま渡すと
          ページのHTMLに全員ぶんの氏名が載ってしまう（個人名も含めて）。
          shop_name に表示名（屋号 → 氏名の欄の会社名）を入れ、name は渡さない。
          こうするとブラウザ側の部品は今までどおり shop_name を見るだけでよい */}
      <SellerDetailClient
        id={id}
        initialSeller={seller ? sellerForBrowser(seller) : null}
        initialMenus={menus}
        initialReviews={reviews}
        initialSns={sns}
      />
    </>
  )
}
