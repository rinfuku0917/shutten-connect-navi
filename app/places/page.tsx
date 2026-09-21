import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import PlacesBrowser, { type Place } from './PlacesBrowser'
import SegmentLinks from './SegmentLinks'
import { segmentForFilter } from './segments'
import { PLACE_CATEGORIES } from '../lib/categories'
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

  // 正規URL。
  //
  // 以前はクエリ付きの自ページ（/places?pref=東京都）を正規URLにしていた。
  // これは AGENTS.md の「インデックスさせたいページは固有のURLパスを持たせる。
  // クエリパラメータだけの出し分けは不可」に正面から当たっていた。
  //
  //   1. その絞り込みに対応する固有ページがある（app/places/segments.ts の11枚）
  //      → その固有URLへ寄せる
  //   2. 対応する固有ページが無い（兵庫県、マルシェ・マーケットなど、未作成の掛け合わせ）
  //      → 素の /places にする。クエリ付き自ページを指すのをやめる
  //   3. 絞り込みなしの /places は、これまでどおり /places
  //
  // 301 は使わない。permanentRedirect は streaming の文脈では meta タグに落ちる
  // （node_modules/next/dist/docs/01-app/03-api-reference/04-functions/permanentRedirect.md）ため
  // 308 が返る保証がなく、しかも PlacesBrowser が history.replaceState で書く
  // ?pref= を 308 にすると、絞り込んだ状態で再読み込み・共有した利用者の
  // 地図・キーワード検索・並び替え・ページ送りが消える。308 はブラウザが恒久
  // キャッシュするので後戻りできない。noindex も足さない（AGENTS.md の禁止事項）。
  //
  // **noindex のときは固有ページへ寄せない。**
  // noindex と「別URLを正規URLとする canonical」を同時に出すのは矛盾した指示で、
  // noindex が canonical 先（＝サイトマップに入れている固有ページ）に
  // 付け替えて解釈されうる。キーワード検索（q）と2ページ目以降は
  // canonical を出さずに noindex だけを出す。
  const segment = noindex ? undefined : segmentForFilter(pref, genre)
  const canonical = noindex ? undefined : (segment ? segment.path : '/places')

  return {
    title: { absolute: `${title} - 出店コネクトナビ` },
    description,
    // layout に canonical は置いていないので、ここで出さなければ canonical は付かない
    ...(canonical ? { alternates: { canonical } } : {}),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, ...(canonical ? { url: canonical } : {}), type: 'website' },
  }
}

// generateMetadata と本体の2か所から呼ぶので、React の cache() で包む。
// 包まないと、1回の表示で公開案件の全件読みが2回走る
const fetchPlaces = cache(async (): Promise<Place[]> => {
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
})

export default async function PlacesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const places = await fetchPlaces()
  const prefs = Array.from(new Set(places.map(p => p.prefecture).filter(Boolean))) as string[]
  const { pref, genre, kw, page, sort } = parseSearch(sp, prefs)

  // 絞り込みの初期値をサーバーから渡す。
  // これがないと、サーバーが返すHTMLは絞り込み前のままになり、
  // 「?pref=東京都」と「/places」の中身が完全に同じになってしまう。
  //
  // リンク帯（SegmentLinks）はサーバー部品のまま渡す。
  // ここの絞り込みは select の onChange なのでクローラーがたどれる <a> が1本も無く、
  // ページ送りも button で href が無い（しかも2ページ目以降は noindex）。
  // 結果として13件目以降の案件は、サイトマップ経由以外に発見経路が無かった。
  // 案件詳細が <RelatedPlaces> をサーバー描画して渡しているのと同じやり方。
  return (
    <PlacesBrowser
      initialPlaces={places}
      initialPref={pref}
      initialGenre={genre}
      initialKw={kw}
      initialPage={page}
      initialSort={sort}
      segmentLinks={<SegmentLinks />}
    />
  )
}
