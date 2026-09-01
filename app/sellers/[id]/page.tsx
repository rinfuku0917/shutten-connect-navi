import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import JsonLd from '../../components/JsonLd'
import { SITE_URL, OG_DEFAULT_IMAGE, breadcrumbJsonLd } from '../../lib/seo'
import SellerDetailClient, { type Seller, type MenuItem, type Review } from './SellerDetailClient'

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
const EXCLUDED_SHOP_NAMES = ['株式会社nav', '株式会社アーク']

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
    .select('id, name, shop_name, genre, areas, photos')
    .eq('id', id)
    .eq('role', 'seller')
    .eq('approval_status', 'approved')
    .maybeSingle()
  return (data as Seller) ?? null
}

async function fetchMenusAndReviews(id: string): Promise<{ menus: MenuItem[]; reviews: Review[] }> {
  const db = client()
  if (!db) return { menus: [], reviews: [] }
  const [{ data: menus }, { data: reviews }] = await Promise.all([
    db.from('menus').select('id, name, price, photo_url, sort_order').eq('seller_id', id)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    db.from('reviews').select('id, reviewer_name, rating, comment, created_at').eq('seller_id', id)
      .eq('status', 'approved').order('created_at', { ascending: false }),
  ])
  return { menus: (menus as MenuItem[]) ?? [], reviews: (reviews as Review[]) ?? [] }
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

function displayName(s: Seller): string {
  return (s.shop_name || s.name || '出店者').trim()
}

// 検索結果に出す説明文。120字前後に収める。
function summarize(s: Seller, menus: MenuItem[]): string {
  const name = displayName(s)
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
  if (EXCLUDED_SHOP_NAMES.includes(name)) {
    return { title: { absolute: `${name} - 出店コネクトナビ` }, robots: { index: false, follow: true } }
  }
  const { menus } = await fetchMenusAndReviews(id)
  const description = summarize(seller, menus)
  const photo = seller.photos && seller.photos.length > 0 ? seller.photos[0] : null

  return {
    title: { absolute: `${name}｜キッチンカー・出店者情報 - 出店コネクトナビ` },
    description,
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
  const { menus, reviews } = seller ? await fetchMenusAndReviews(id) : { menus: [], reviews: [] }

  const name = seller ? displayName(seller) : ''
  const genres = seller ? toArray(seller.genre) : []
  const areas = seller ? (seller.areas ?? []).map(x => String(x).trim()).filter(Boolean) : []
  const photo = seller?.photos && seller.photos.length > 0 ? seller.photos[0] : null

  return (
    <>
      {seller && !EXCLUDED_SHOP_NAMES.includes(name) && (
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

      <SellerDetailClient id={id} initialSeller={seller} initialMenus={menus} initialReviews={reviews} />
    </>
  )
}
