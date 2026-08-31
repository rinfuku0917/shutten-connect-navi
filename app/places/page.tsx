import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PlacesBrowser, { type Place } from './PlacesBrowser'

// 出店場所（案件）の一覧。
//
// 絞り込みと地図はブラウザ側で動かすが、案件の読み込みはここで行う。
// 以前はブラウザ側で読み込んでいたため、検索エンジンには
// カードが1枚も見えていなかった。
//
// 出店料のログイン制限は変えていない。制限はブラウザ側の判定なので、
// サーバーで作るHTMLには金額が入らない。

export const revalidate = 600

export const metadata: Metadata = {
  title: 'キッチンカーの出店募集・出店場所一覧｜全国',
  description:
    '全国のキッチンカー出店募集を掲載しています。イベント、商業施設、スーパーの駐車場、オフィスなどの出店場所を都道府県・カテゴリーで絞り込んで探せます。',
  alternates: { canonical: '/places' },
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

export default async function PlacesPage() {
  const places = await fetchPlaces()
  return <PlacesBrowser initialPlaces={places} />
}
