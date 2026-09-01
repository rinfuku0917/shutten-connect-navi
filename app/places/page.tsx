import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PlacesBrowser, { type Place } from './PlacesBrowser'
import { PLACE_CATEGORIES } from '../lib/categories'

// 出店場所（案件）の一覧。
//
// 絞り込みと地図はブラウザ側で動かすが、案件の読み込みはここで行う。
// 以前はブラウザ側で読み込んでいたため、検索エンジンには
// カードが1枚も見えていなかった。
//
// 出店料のログイン制限は変えていない。制限はブラウザ側の判定なので、
// サーバーで作るHTMLには金額が入らない。

export const revalidate = 600

type Search = { pref?: string; genre?: string; q?: string; page?: string; sort?: string }

// 絞り込みの値を、決められたものだけに正規化する。
// 何でも受け付けると、無限に近いURLが検索エンジンに拾われてしまう。
function parseSearch(sp: Search, prefs: string[]) {
  const pref = sp.pref && prefs.includes(sp.pref) ? sp.pref : ''
  const genre = sp.genre && (PLACE_CATEGORIES as readonly string[]).includes(sp.genre) ? sp.genre : ''
  const kw = (sp.q ?? '').trim().slice(0, 60)
  const n = parseInt(sp.page ?? '1', 10)
  const page = Number.isFinite(n) && n > 1 ? n : 1
  const sort: 'new' | 'name' = sp.sort === 'name' ? 'name' : 'new'
  return { pref, genre, kw, page, sort }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams
  const places = await fetchPlaces()
  const prefs = Array.from(new Set(places.map(p => p.prefecture).filter(Boolean))) as string[]
  const { pref, genre, kw, page } = parseSearch(sp, prefs)

  // キーワード検索と2ページ目以降は、中身が薄くなったり重複したりするので
  // 検索結果には出さない。リンクはたどれるようにしておく（follow）。
  const noindex = Boolean(kw) || page > 1

  const where = pref || '全国'
  const what = genre ? `${genre}の` : ''
  const title = pref || genre
    ? `${where}の${what}キッチンカー出店場所・出店募集一覧`
    : 'キッチンカーの出店募集・出店場所一覧｜全国'
  const count = places.filter(p => (!pref || p.prefecture === pref) && (!genre || (p.genres ?? []).includes(genre))).length
  const description = pref || genre
    ? `${where}の${what}キッチンカー出店場所を${count}件掲載しています。イベント、商業施設、スーパーの駐車場、オフィスなどの出店募集を条件で絞り込んで探せます。掲載・応募は無料です。`
    : '全国のキッチンカー出店募集を掲載しています。イベント、商業施設、スーパーの駐車場、オフィスなどの出店場所を都道府県・カテゴリーで絞り込んで探せます。'

  // 正規URLは絞り込みの条件を含める（並び順とページ番号は含めない）
  const qs = new URLSearchParams()
  if (pref) qs.set('pref', pref)
  if (genre) qs.set('genre', genre)
  const canonical = qs.toString() ? `/places?${qs.toString()}` : '/places'

  return {
    title: { absolute: `${title} - 出店コネクトナビ` },
    description,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: canonical, type: 'website' },
  }
}

async function fetchPlaces(): Promise<Place[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data } = await db
      .from('places')
      .select('id, title, prefecture, address, fee, place_type, closed, genres, image_url, latitude, longitude, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct')
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('posted_at', { ascending: false })
    return (data as Place[]) ?? []
  } catch {
    return []
  }
}

export default async function PlacesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const places = await fetchPlaces()
  const prefs = Array.from(new Set(places.map(p => p.prefecture).filter(Boolean))) as string[]
  const { pref, genre, kw, page, sort } = parseSearch(sp, prefs)

  // 絞り込みの初期値をサーバーから渡す。
  // これがないと、サーバーが返すHTMLは絞り込み前のままになり、
  // 「?pref=東京都」と「/places」の中身が完全に同じになってしまう。
  return (
    <PlacesBrowser
      initialPlaces={places}
      initialPref={pref}
      initialGenre={genre}
      initialKw={kw}
      initialPage={page}
      initialSort={sort}
    />
  )
}
