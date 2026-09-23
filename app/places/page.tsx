import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PlacesBrowser, { type Place } from './PlacesBrowser'
import SegmentLinks from './SegmentLinks'
import { selectWithOptionalColumn } from '../lib/optionalColumn'

// 出店場所（案件）の一覧。
//
// 絞り込みと地図はブラウザ側で動かすが、案件の読み込みはここで行う。
// 以前はブラウザ側で読み込んでいたため、検索エンジンには
// カードが1枚も見えていなかった。
//
// 出店料のログイン制限は変えていない。制限はブラウザ側の判定なので、
// サーバーで作るHTMLには金額が入らない。

export const revalidate = 600

// ★このページは searchParams（?pref= など）を読まない。
//
// 読むと Next はこのページを「動的描画」に切り替え、revalidate の宣言があっても
// ISR も CDN キャッシュも効かなくなる
// （node_modules/next/dist/docs/01-app/03-api-reference/04-functions/… の searchParams）。
// 実測（2026-09-23）では /places の TTFB が 1.5 秒・x-vercel-cache が毎回 MISS で、
// 表示のたびに公開案件1,384件の全件読みが走っていた。サイトで最も重い入口だった。
//
// サーバーで絞り込んだHTMLを作る必要はもう無い：
//   ・検索に出したい絞り込み（都道府県・場所の種類）は固有ページが持っている
//     （/places/area/tokyo など。app/places/segments.ts）
//   ・それ以外のクエリ（段の外の県、キーワード、2ページ目）は、
//     以前から canonical を素の /places に寄せるか noindex にしていたので、
//     中身が絞り込み前のままでも検索結果は変わらない
//   ・利用者から見た絞り込みは、これまでどおりブラウザ側で効く
//     （PlacesBrowser がURLの ?pref= 等を読んで復元する）
//
// canonical は自ページ（/places）を明示する。layout から継承させない（AGENTS.md）。
const title = 'キッチンカーの出店募集・出店場所一覧｜全国'
const description = '全国のキッチンカー出店募集を掲載しています。イベント、商業施設、スーパーの駐車場、オフィスなどの出店場所を都道府県・カテゴリーで絞り込んで探せます。'

export const metadata: Metadata = {
  title: { absolute: `${title} - 出店コネクトナビ` },
  description,
  alternates: { canonical: '/places' },
  openGraph: { title, description, url: '/places', type: 'website' },
}

const fetchPlaces = async (): Promise<Place[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    // format_fees と min_guarantee も読むのは、一覧のカードに
    // 「最低保証あり」を出すため（額は詳細ページで出す）。
    // min_guarantee は移行SQLを流すまで列が無いので、
    // 列が無い環境ではその列だけ落として読み直す（一覧が空になるのを防ぐ）
    const cols = 'id, title, prefecture, address, fee, place_type, closed, genres, image_url, latitude, longitude, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, format_fees'
    const { data } = await selectWithOptionalColumn(withMin => db
      .from('places')
      .select(cols + (withMin ? ', min_guarantee' : ''))
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('posted_at', { ascending: false }))
    return (data as Place[] | null) ?? []
  } catch {
    return []
  }
}

export default async function PlacesPage() {
  const places = await fetchPlaces()

  // 案件の読み込みはここ（サーバー）で行う。
  // 以前はブラウザ側で読み込んでいたため、検索エンジンにはカードが1枚も見えていなかった。
  // 絞り込みの初期値は渡さない（上の★のとおり、クエリはブラウザ側で読む）。
  //
  // リンク帯（SegmentLinks）はサーバー部品のまま渡す。
  // ここの絞り込みは select の onChange なのでクローラーがたどれる <a> が1本も無く、
  // ページ送りも button で href が無い。
  // 結果として13件目以降の案件は、サイトマップ経由以外に発見経路が無かった。
  // 案件詳細が <RelatedPlaces> をサーバー描画して渡しているのと同じやり方。
  return (
    <PlacesBrowser
      initialPlaces={places}
      segmentLinks={<SegmentLinks />}
    />
  )
}
