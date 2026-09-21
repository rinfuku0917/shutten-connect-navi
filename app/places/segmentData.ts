import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { PLACE_CATEGORIES } from '../lib/categories'
import { cityOf, dowsOf, placeTypeLabel, DOW, WEEKDAY_CHARS, DETAIL_FLAGS } from '../lib/placeFacts.mjs'
import type { Segment } from './segments'

// エリア別・カテゴリ別ページに出す「集合」と「内訳」を作る。
//
// **出店料（金額）の列を1本も読まない。**
// 出店料はログイン後だけの表示で、その制限は PlacesBrowser / PlaceDetailClient の
// ブラウザ側の判定でかけている。このページはサーバーで描くので、
// 読んでしまえばそのままHTMLに出る＝自分で止めないと漏れる。
// 止め方として「表示しない」ではなく「select に書かない」を選んでいるのは、
// 後から画面を足す人が誤って出せないようにするため（値が手元に無ければ出せない）。
// fee / price_fixed / price_share_pct / company_* / format_fees / min_guarantee /
// day_type_fees は下の COLUMNS に入れないこと。
//
// 読み込みは公開案件を1回だけ。React の cache() で包んであるので、
// 同じリクエストの中で generateMetadata と本体から呼んでも取得は1回で済む。

/** 一覧の行に出す分だけ。金額は持たない */
export type SegmentPlace = {
  id: string
  title: string
  prefecture: string | null
  city: string
  typeLabel: string
  closed: boolean
}

/** 内訳を作るために読む行（画面には出さない列も含む） */
type Row = {
  id: string
  title: string | null
  prefecture: string | null
  address: string | null
  place_type: string | null
  closed: boolean | null
  genres: string[] | null
  open_days: unknown
  schedule: unknown
  details: Record<string, string> | null
  max_slots: number | null
  posted_at: string | null
  closed_at: string | null
  created_at: string | null
}

const COLUMNS = 'id, title, prefecture, address, place_type, closed, genres, open_days, schedule, details, max_slots, posted_at, closed_at, created_at, pinned'

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const CHUNK = 1000

/** 公開案件（募集終了も含む）を全件。取れなければ null を返す。
 *  空配列と区別するのは、取得に失敗したときに「0件」と書かないため
 *  （0件の一覧を出すと doorway そのものになる）。 */
export const fetchPublishedPlaces = cache(async (): Promise<Row[] | null> => {
  const client = db()
  if (!client) return null
  try {
    const out: Row[] = []
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await client
        .from('places')
        .select(COLUMNS)
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('posted_at', { ascending: false })
        .range(from, from + CHUNK - 1)
      if (error) return null
      if (!data || data.length === 0) break
      out.push(...(data as unknown as Row[]))
      if (data.length < CHUNK) break
    }
    return out
  } catch {
    return null
  }
})

function belongs(seg: Segment, r: Row): boolean {
  if (seg.pref && r.prefecture !== seg.pref) return false
  if (seg.genre && !(Array.isArray(r.genres) ? r.genres : []).includes(seg.genre)) return false
  return true
}

/** 曜日の内訳。母数は「曜日が読み取れた件数」で、掲載全件とは違う。
 *  画面には必ず母数を書く（docs/seo-keywords.md の教訓2：集計の母数を混ぜる）。 */
export type DowFacts = {
  known: number
  allWeek: number
  weekdayOnly: number
  weekendIncluded: number
  byDow: CountEntry[]
  /** 日付が入っている案件だけの日数。祝日は判定していないので「土日」まで */
  weekdayDays: number
  weekendDays: number
}

export type CountEntry = { label: string; count: number }

export type SegmentFacts = {
  total: number
  open: number
  done: number
  byType: CountEntry[]
  dow: DowFacts
  /** 市区町村。上位だけを出すので、上位で説明できている件数（shown）も返す */
  cities: { top: CountEntry[]; shown: number; rest: number; restCities: number; unknown: number }
  /** 設備・条件。母数は details を書いている件数 */
  details: { withDetails: number; flags: { name: string; entries: CountEntry[] }[] }
  /** 募集枠。289件中261件が既定値の5台で分布にならないので、内訳にはせず1文にする */
  slots: { multi: number; counted: number }
  /** 県ページの「カテゴリー別の内訳」。母数は genres が入っている件数 */
  genresFilled: number
  byGenre: CountEntry[]
  /** カテゴリページの「都道府県別の内訳」 */
  byPref: CountEntry[]
  /** サイトマップの lastModified に使う */
  lastModified?: Date
}

export type SegmentSet = {
  /** 取得に失敗したときは false。画面は一覧を「ただいま取得できません」にする */
  ok: boolean
  open: SegmentPlace[]
  done: SegmentPlace[]
  facts: SegmentFacts
}

/** 1ページに並べる行の上限。募集中・実績それぞれに効く。
 *  ここに当たったらページ送りか掛け合わせの追加を人が判断する（いまは先送り）。 */
const MAX_ROWS = 150

const CITY_TOP = 8

// placeFacts.mjs は素のJSなので、DETAIL_FLAGS の map は
// 項目ごとに違う形（{yes,no} と {kitchen,tent,both} など）として推論される。
// 選択肢の文字から表示名を引くだけなので、ここで1つの形にそろえて扱う
type DetailFlag = { name: string; key: string; map: Record<string, string | undefined>; show: boolean }
const FLAGS = DETAIL_FLAGS as unknown as DetailFlag[]

function toPlace(r: Row): SegmentPlace {
  return {
    id: r.id,
    title: r.title ?? '（名称未設定）',
    prefecture: r.prefecture,
    city: cityOf(r.address),
    typeLabel: placeTypeLabel(r.place_type),
    closed: Boolean(r.closed),
  }
}

function sortEntries(map: Map<string, number>, limit?: number): CountEntry[] {
  const list = [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'))
  return limit == null ? list : list.slice(0, limit)
}

function countFacts(rows: Row[]): SegmentFacts {
  // 出店形態（常設／イベント）
  const typeMap = new Map<string, number>()
  for (const r of rows) {
    const k = placeTypeLabel(r.place_type)
    typeMap.set(k, (typeMap.get(k) ?? 0) + 1)
  }

  // 曜日
  const dowMap = new Map<string, number>()
  const dow: DowFacts = {
    known: 0, allWeek: 0, weekdayOnly: 0, weekendIncluded: 0,
    byDow: [], weekdayDays: 0, weekendDays: 0,
  }
  for (const r of rows) {
    const { dows, dates } = dowsOf(r)
    for (const d of dates) {
      if (d.getDay() === 0 || d.getDay() === 6) dow.weekendDays += 1
      else dow.weekdayDays += 1
    }
    if (dows.length === 0) continue
    dow.known += 1
    for (const d of dows) dowMap.set(d, (dowMap.get(d) ?? 0) + 1)
    const hasWeekend = dows.includes('土') || dows.includes('日')
    const hasWeekday = dows.some((d: string) => WEEKDAY_CHARS.includes(d))
    if (dows.length === 7) dow.allWeek += 1
    if (hasWeekend) dow.weekendIncluded += 1
    if (hasWeekday && !hasWeekend) dow.weekdayOnly += 1
  }
  // 曜日は月曜から並べる（多い順だと県ごとに並びが変わって読み比べにくい）
  dow.byDow = [...DOW.slice(1), DOW[0]]
    .map((label: string) => ({ label, count: dowMap.get(label) ?? 0 }))
    .filter((x: CountEntry) => x.count > 0)

  // 市区町村。上位だけを出すので、上位で何件ぶんを説明できているかも数える
  const cityMap = new Map<string, number>()
  for (const r of rows) {
    const c = cityOf(r.address)
    cityMap.set(c, (cityMap.get(c) ?? 0) + 1)
  }
  const unknown = cityMap.get('不明') ?? 0
  cityMap.delete('不明')
  const cityTop = sortEntries(cityMap, CITY_TOP)
  const shown = cityTop.reduce((n, x) => n + x.count, 0)
  const cities = {
    top: cityTop,
    shown,
    rest: rows.length - shown - unknown,
    restCities: Math.max(0, cityMap.size - cityTop.length),
    unknown,
  }

  // 設備・条件。母数は details を書いている件数
  const withDetailRows = rows.filter(r => r.details && typeof r.details === 'object')
  const flags = FLAGS
    .filter(f => f.show)
    .map(f => {
      const m = new Map<string, number>()
      for (const r of withDetailRows) {
        const raw = String(r.details?.[f.key] ?? '').trim()
        if (!raw) continue
        const label = f.map[raw] ?? raw
        m.set(label, (m.get(label) ?? 0) + 1)
      }
      return { name: f.name, entries: sortEntries(m) }
    })
    .filter(f => f.entries.length > 0)

  // 募集枠。内訳にはしない（既定値の5台がほとんどで分布にならない）
  const counted = rows.filter(r => r.max_slots != null).length
  const multi = rows.filter(r => (r.max_slots ?? 0) > 1).length

  // カテゴリー別・都道府県別
  const genreMap = new Map<string, number>()
  let genresFilled = 0
  for (const r of rows) {
    const gs = (Array.isArray(r.genres) ? r.genres : []).filter(Boolean)
    if (gs.length > 0) genresFilled += 1
    for (const g of gs) genreMap.set(g, (genreMap.get(g) ?? 0) + 1)
  }
  const prefMap = new Map<string, number>()
  for (const r of rows) {
    if (!r.prefecture) continue
    prefMap.set(r.prefecture, (prefMap.get(r.prefecture) ?? 0) + 1)
  }

  // lastModified。STATIC_UPDATED の固定値ではなく、その集合の実際の最終更新にする
  let lastModified: Date | undefined
  for (const r of rows) {
    for (const v of [r.closed_at, r.posted_at, r.created_at]) {
      if (typeof v !== 'string' || !v) continue
      const d = new Date(v)
      if (isNaN(d.getTime())) continue
      if (!lastModified || d > lastModified) lastModified = d
    }
  }

  return {
    total: rows.length,
    open: rows.filter(r => !r.closed).length,
    done: rows.filter(r => r.closed).length,
    byType: sortEntries(typeMap),
    dow,
    cities,
    details: { withDetails: withDetailRows.length, flags },
    slots: { multi, counted },
    genresFilled,
    // 一覧に無いジャンル名がDBに残っていても画面には出さない（表記ゆれを混ぜない）
    byGenre: sortEntries(genreMap).filter(e => (PLACE_CATEGORIES as readonly string[]).includes(e.label)),
    byPref: sortEntries(prefMap),
    lastModified,
  }
}

const EMPTY_FACTS: SegmentFacts = {
  total: 0, open: 0, done: 0, byType: [],
  dow: { known: 0, allWeek: 0, weekdayOnly: 0, weekendIncluded: 0, byDow: [], weekdayDays: 0, weekendDays: 0 },
  cities: { top: [], shown: 0, rest: 0, restCities: 0, unknown: 0 },
  details: { withDetails: 0, flags: [] },
  slots: { multi: 0, counted: 0 },
  genresFilled: 0, byGenre: [], byPref: [],
}

/** 1つのセグメントの集合と内訳。取得に失敗したら ok:false（件数は0のまま）。 */
export async function loadSegment(seg: Segment): Promise<SegmentSet> {
  const rows = await fetchPublishedPlaces()
  if (!rows) return { ok: false, open: [], done: [], facts: EMPTY_FACTS }
  const mine = rows.filter(r => belongs(seg, r))
  // 並びは /places と同じ（ピン留め→掲載日の降順）。fetch 側で order 済みなので
  // ここでは募集中と募集終了に分けるだけにする。JSON-LD の ItemList は
  // この open 配列をそのまま使うので、画面の順序と件数が必ず一致する
  return {
    ok: true,
    open: mine.filter(r => !r.closed).slice(0, MAX_ROWS).map(toPlace),
    done: mine.filter(r => r.closed).slice(0, MAX_ROWS).map(toPlace),
    facts: countFacts(mine),
  }
}

/** サイトマップ用。11枚ぶんの件数と最終更新だけをまとめて返す。
 *
 *  読み込みは fetchPublishedPlaces の1本で、セグメントが増えてもクエリは増えない。
 *  ただし **app/sitemap.ts の中では公開案件の全件読みが2本走る**。
 *  あちらは案件URLを出すために id / posted_at / created_at / closed / closed_at を
 *  自前で読んでおり、こちらの COLUMNS（jsonb の details / schedule / open_days を含む）とは
 *  別のクエリになる。設計書は「既存の select に prefecture, genres を足して0本」と
 *  していたが、11枚の内訳を数えるのに details まで要るので分けてある。
 *  sitemap は revalidate 3600 なので実害は小さいが、読み取りコストは2本ぶん。 */
export async function loadSegmentStamps(
  segs: Segment[],
): Promise<Map<string, { total: number; lastModified?: Date }> | null> {
  const rows = await fetchPublishedPlaces()
  if (!rows) return null
  const out = new Map<string, { total: number; lastModified?: Date }>()
  for (const seg of segs) {
    const f = countFacts(rows.filter(r => belongs(seg, r)))
    out.set(seg.slug, { total: f.total, lastModified: f.lastModified })
  }
  return out
}

/** リンク帯（SegmentLinks）が使う、県ごと・カテゴリごとの件数。
 *  ページを作っていない県も出すので、セグメントとは別に数える。 */
export type BrowseCounts = {
  ok: boolean
  byPref: CountEntry[]
  byGenre: CountEntry[]
  /** 掲載1〜2件の県は、県ページを作らずに案件そのものへ直接リンクする */
  thinPrefPlaces: Map<string, SegmentPlace[]>
}

export async function loadBrowseCounts(): Promise<BrowseCounts> {
  const rows = await fetchPublishedPlaces()
  if (!rows) return { ok: false, byPref: [], byGenre: [], thinPrefPlaces: new Map() }
  const f = countFacts(rows)
  const thin = new Map<string, SegmentPlace[]>()
  for (const e of f.byPref) {
    if (e.count > 2) continue
    thin.set(e.label, rows.filter(r => r.prefecture === e.label).map(toPlace))
  }
  return { ok: true, byPref: f.byPref, byGenre: f.byGenre, thinPrefPlaces: thin }
}
