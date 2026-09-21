// 「出店したい人向け」の固有URL（エリア別・カテゴリ別の一覧）の唯一の正。
//
// ここを読むもの:
//   ・app/places/area/[pref]/page.tsx        … generateStaticParams とページ本体
//   ・app/places/category/[tag]/page.tsx
//   ・app/places/area/[pref]/[tag]/page.tsx
//   ・app/sitemap.ts                          … 申告するURLと priority
//   ・app/places/SegmentLinks.tsx              … /places・/space のリンク帯
//   ・app/places/page.tsx                      … ?pref= / ?genre= の canonical の寄せ先
//   ・app/places/[id]/PlaceDetailClient.tsx    … 終了案件から同じ県の一覧への案内
//
// 4か所が別々に「どのページがあるか」を判定すると
// 「ページはあるのにサイトマップに無い」「canonical が404を指す」が構造的に起きる。
// 判定を足したくなったら、ここに関数を1本増やして全員がそれを呼ぶ形にすること。
//
// **DBから自動で生やさない。**
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md に
// 「During revalidation (ISR), generateStaticParams will not be called again」と書いてある。
// 件数を数えてページ集合を決める作りにすると、毎時DBを読み直す app/sitemap.ts だけが
// 新しい組み合わせを申告し、プリレンダ済みのページ集合は古いまま固定されてずれる。
// 増減は人が下のリストを1行足す・消すコミットで行う（npm run seo:segments が候補を報告する）。

import { PLACE_CATEGORIES } from '../lib/categories'

/** 開設・撤退のしきい値（掲載合計＝募集中＋募集終了で測る）。
 *  募集中だけで測らないのは、2026-09 に運営が「募集終了の案件も出店実績として
 *  インデックスさせる」と決めており、中身の量を募集中だけで測ると方針とずれるため。
 *  開設と撤退をずらしている（ヒステリシス）のは、1件の増減でサイトマップと
 *  内部リンクが毎月ぶれるのを防ぐため。判定は自動にしない。 */
export const THRESHOLDS = {
  /** 都道府県。/places は1ページ12件なので、12件を超えない集合は「1画面の切り出し」にすぎない */
  areaOpen: 12,
  areaRetire: 8,
  /** 全国カテゴリ。全国集合なので県より高い線にする */
  categoryOpen: 20,
  categoryRetire: 14,
  /** 都道府県×カテゴリ。親が2枚あるので線を上げる */
  crossOpen: 15,
  crossRetire: 12,
  /** 親とほぼ同じ集合を2URLで出さないための歯止め（どちらの親に対しても） */
  crossMaxParentRatio: 0.6,
} as const

export type SegmentKind = 'area' | 'category' | 'cross'

export type Segment = {
  /** 原稿（segmentCopy.ts）とサイトマップの鍵。パスから '/places/' を取ったもの */
  slug: string
  kind: SegmentKind
  /** 公開URL（先頭スラッシュあり）。canonical にもそのまま使う */
  path: string
  /** places.prefecture に入っている値 */
  pref?: string
  /** places.genres に入っている値 */
  genre?: string
  /** URLに出る県のスラッグ。app/vendor/area/areas.ts と同じ綴りにそろえている */
  areaSlug?: string
  /** URLに出るカテゴリのスラッグ */
  tagSlug?: string
  /** h1。ページに1つだけ */
  h1: string
  /** パンくず・リンク帯・兄弟リンクでの呼び方 */
  shortName: string
  /** title は { absolute } で指定する（layout の template と二重に付くのを避ける） */
  title: string
  /** description の1文目の主語。「◯◯を90件掲載しています」の◯◯にあたる部分。
   *  11枚の description が同じ文にならないよう、ページごとに言い方を変えている */
  metaNoun: string
  /** 実績モード。募集中がごく少なく、出店実績が主役になっている集合。
   *  募集中ブロックより先に実績ブロックを出し、サイトマップの priority も下げる。
   *  **noindex は付けない**（AGENTS.md の禁止事項）。 */
  achievementMode: boolean
  /** サイトマップの priority と更新頻度 */
  priority: number
  changeFrequency: 'daily' | 'weekly' | 'monthly'
  /** 同じ県の「呼びたい方向け」ページへの1本。相互リンクは各1本に絞る（共食い対策）。
   *  カテゴリページと cross からは張らない。 */
  vendorAreaSlug?: string
  /** そのジャンルに出店者を呼びたい施設向けの記事（カテゴリページからだけ1本） */
  hostArticle?: { slug: string; label: string }
}

// ---- 都道府県 6枚 ----
//
// 掲載合計（2026-09 の実データ）：東京90 / 埼玉40 / 神奈川36 / 千葉32 / 茨城23 / 大阪23。
// 大阪は募集中2件なので実績モードで公開する（掲載23件あり、開設線12件は満たしている）。
const AREA: Segment[] = [
  {
    slug: 'area/tokyo', kind: 'area', path: '/places/area/tokyo',
    pref: '東京都', areaSlug: 'tokyo',
    h1: '東京都のキッチンカー出店場所・出店募集一覧',
    shortName: '東京都',
    title: '東京都のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '東京都のキッチンカー出店場所',
    achievementMode: false, priority: 0.8, changeFrequency: 'daily',
    vendorAreaSlug: 'tokyo',
  },
  {
    slug: 'area/saitama', kind: 'area', path: '/places/area/saitama',
    pref: '埼玉県', areaSlug: 'saitama',
    h1: '埼玉県のキッチンカー出店場所・出店募集一覧',
    shortName: '埼玉県',
    title: '埼玉県のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '埼玉県のキッチンカー出店場所',
    achievementMode: false, priority: 0.8, changeFrequency: 'daily',
    vendorAreaSlug: 'saitama',
  },
  {
    slug: 'area/kanagawa', kind: 'area', path: '/places/area/kanagawa',
    pref: '神奈川県', areaSlug: 'kanagawa',
    h1: '神奈川県のキッチンカー出店場所・出店募集一覧',
    shortName: '神奈川県',
    title: '神奈川県のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '神奈川県のキッチンカー出店場所',
    achievementMode: false, priority: 0.8, changeFrequency: 'daily',
    vendorAreaSlug: 'kanagawa',
  },
  {
    slug: 'area/chiba', kind: 'area', path: '/places/area/chiba',
    pref: '千葉県', areaSlug: 'chiba',
    h1: '千葉県のキッチンカー出店場所・出店募集一覧',
    shortName: '千葉県',
    title: '千葉県のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '千葉県のキッチンカー出店場所',
    achievementMode: false, priority: 0.8, changeFrequency: 'daily',
    vendorAreaSlug: 'chiba',
  },
  {
    slug: 'area/ibaraki', kind: 'area', path: '/places/area/ibaraki',
    pref: '茨城県', areaSlug: 'ibaraki',
    h1: '茨城県のキッチンカー出店場所・出店募集一覧',
    shortName: '茨城県',
    title: '茨城県のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '茨城県のキッチンカー出店場所',
    achievementMode: false, priority: 0.8, changeFrequency: 'daily',
    vendorAreaSlug: 'ibaraki',
  },
  {
    slug: 'area/osaka', kind: 'area', path: '/places/area/osaka',
    pref: '大阪府', areaSlug: 'osaka',
    h1: '大阪府のキッチンカー出店場所・出店募集一覧',
    shortName: '大阪府',
    title: '大阪府のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '大阪府のキッチンカー出店場所',
    // 募集中2件 / 出店実績21件
    achievementMode: true, priority: 0.6, changeFrequency: 'weekly',
    vendorAreaSlug: 'osaka',
  },
]

// ---- 全国カテゴリ 4枚 ----
//
// 掲載合計：大学・学校55 / イベント会場46 / スーパーマーケット36 / 商業施設28。
// 大学・学校（募集中14 / 実績41）は実績が主役なので実績モードで出す。
//
// 「飲食向け」123件・「物販向け」13件はページを作らない。件数不足ではなく種類が違う。
// この2つは会場の種類ではなく「どんな出店者に向く募集か」という適性フラグで、
// 「キッチンカー 飲食向け 出店」という検索語が存在しない。しかも東京×飲食向けは
// 東京全体90件の46%、茨城×飲食向けは茨城23件の65%で、県ページとほぼ同じ集合になる。
const CATEGORY: Segment[] = [
  {
    slug: 'category/school', kind: 'category', path: '/places/category/school',
    genre: '大学・学校', tagSlug: 'school',
    h1: '大学・専門学校のキッチンカー出店場所・出店募集一覧',
    shortName: '大学・学校',
    title: '大学・専門学校のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '大学・専門学校の構内でのキッチンカー出店募集',
    // 募集中14 / 出店実績41
    achievementMode: true, priority: 0.7, changeFrequency: 'weekly',
    hostArticle: { slug: 'campus-food-truck', label: '学校にキッチンカーを呼びたい方へ' },
  },
  {
    slug: 'category/event-venue', kind: 'category', path: '/places/category/event-venue',
    genre: 'イベント会場', tagSlug: 'event-venue',
    h1: 'イベント会場のキッチンカー出店場所・出店募集一覧',
    shortName: 'イベント会場',
    title: 'イベント会場のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: '催しの会場でのキッチンカー出店募集',
    achievementMode: false, priority: 0.75, changeFrequency: 'weekly',
    hostArticle: { slug: 'how-to-invite-kitchen-car', label: 'イベントにキッチンカーを呼びたい方へ' },
  },
  {
    slug: 'category/supermarket', kind: 'category', path: '/places/category/supermarket',
    genre: 'スーパーマーケット', tagSlug: 'supermarket',
    h1: 'スーパーの店頭・駐車場のキッチンカー出店場所・出店募集一覧',
    shortName: 'スーパーマーケット',
    title: 'スーパーの店頭・駐車場のキッチンカー出店募集一覧 - 出店コネクトナビ',
    metaNoun: 'スーパーマーケットの店頭・駐車場でのキッチンカー出店募集',
    achievementMode: false, priority: 0.75, changeFrequency: 'weekly',
    hostArticle: { slug: 'supermarket-food-truck', label: 'スーパーにキッチンカーを呼びたい方へ' },
  },
  {
    slug: 'category/shopping-mall', kind: 'category', path: '/places/category/shopping-mall',
    genre: '商業施設', tagSlug: 'shopping-mall',
    h1: '商業施設のキッチンカー出店場所・出店募集一覧',
    shortName: '商業施設',
    title: '商業施設のキッチンカー出店場所・出店募集一覧 - 出店コネクトナビ',
    metaNoun: 'ショッピングモール・商業施設の屋外スペースでのキッチンカー出店募集',
    achievementMode: false, priority: 0.75, changeFrequency: 'weekly',
    hostArticle: { slug: 'mall-food-truck-event', label: '商業施設にキッチンカーを呼びたい方へ' },
  },
]

// ---- 都道府県×カテゴリ 1枚 ----
//
// **掛け合わせの向きは area→category に固定する。**
// /places/category/school/tokyo は作らない。両方向を許すと同じ集合に2つのURLが生まれる。
//
// 東京都×大学・学校 掲載28件（募集中5 / 実績23）。東京90の31% / 大学・学校55の51%で、
// どちらの親に対しても crossMaxParentRatio（60%）を超えていない。
const CROSS: Segment[] = [
  {
    slug: 'area/tokyo/school', kind: 'cross', path: '/places/area/tokyo/school',
    pref: '東京都', genre: '大学・学校', areaSlug: 'tokyo', tagSlug: 'school',
    h1: '東京都の大学・専門学校のキッチンカー出店場所・出店募集一覧',
    shortName: '東京都の大学・学校',
    title: '東京都の大学・専門学校のキッチンカー出店場所一覧 - 出店コネクトナビ',
    metaNoun: '東京都の大学・専門学校でのキッチンカー出店募集',
    // 募集中5 / 出店実績23
    achievementMode: true, priority: 0.65, changeFrequency: 'weekly',
  },
]

// 次に作る候補（開設線に届いたら人が上のリストへ1行足す。原稿を同じコミットで書く）:
//   /places/area/kanagawa/event-venue  12件 → 15件で開設
//   /places/area/chiba/event-venue     11件 → 15件で開設
//   /places/area/tokyo/event-venue     10件 → 15件で開設
//   /places/area/hyogo                 10件 → 12件で開設
//   /places/area/gunma                  9件 → 12件で開設
// 作らないと決めたもの:
//   茨城県×スーパーマーケット 15件 … 件数は満たすが茨城23件の65%で crossMaxParentRatio 超え。
//     B-7 の語は全国の /places/category/supermarket で取り、そこから茨城県ページへ送る
//   /places/area と /places/category の索引2枚 … 検索語を持たず、パンくずが5階層になって
//     案件詳細（3階層）と揃わない。役目は /places のリンク帯（SegmentLinks）が引き受ける

// ───────────────────────────────────────────────────────────────────────────
// 公開する段（2026-09-21 の決定）
//
// 11枚は作り終えているが、出すのは3回に分ける。
// 理由は SEO の効果ではなく切り分け：
//   /vendor/area/{pref} 10枚が同じ「県名＋キッチンカー」で先に評価を持っている。
//   11枚を同時に出すと、順位が動いたときに何が原因か分からない。
//   6枚だけ先に出せば、Search Console で既存ページが落ちていないかを見て、
//   悪ければ次の段に進まないという判断ができる。
//
// 次の段に進める条件（2〜3週間後に見る）:
//   ・/vendor/area/{pref} の表示回数・平均掲載順位が落ちていない
//   ・/places/area/* 6枚が「クロール済み - インデックス未登録」で止まっていない
//
// 段を進めるときは WAVE を 2 → 3 に上げるだけでよい（ほかは触らない）。
//   1 … 県6枚
//   2 … ＋全国カテゴリ4枚
//   3 … ＋県×カテゴリ1枚（/places/area/tokyo/school）
// sitemap・generateStaticParams・リンク帯・点検スクリプトはすべて
// この SEGMENTS を読むので、ここを切り替えれば公開範囲がまとまって動く。
const WAVE: 1 | 2 | 3 = 1

export const SEGMENTS: Segment[] = [
  ...AREA,
  ...(WAVE >= 2 ? CATEGORY : []),
  ...(WAVE >= 3 ? CROSS : []),
]
export const AREA_SEGMENTS = AREA
export const CATEGORY_SEGMENTS = WAVE >= 2 ? CATEGORY : []
export const CROSS_SEGMENTS = WAVE >= 3 ? CROSS : []

/** slug（'area/tokyo'）から引く */
export function findSegment(slug: string): Segment | undefined {
  return SEGMENTS.find(s => s.slug === slug)
}

/** URLのパラメータから引く。ページの generateStaticParams / generateMetadata から使う */
export function findAreaSegment(areaSlug: string): Segment | undefined {
  return AREA.find(s => s.areaSlug === areaSlug)
}
// 段の外のページは見つからない扱いにする（＝404）。
// 一覧・sitemap・リンク帯・ページの有無が同じ WAVE で決まるようにしておかないと、
// 「サイトマップに無いのにURLでは開ける」状態ができ、公開していないはずの
// ページが被リンクや共有から拾われる。
// 次の段の中身を先に見たいときは、手元で WAVE を上げて確かめる。
export function findCategorySegment(tagSlug: string): Segment | undefined {
  return CATEGORY_SEGMENTS.find(s => s.tagSlug === tagSlug)
}
export function findCrossSegment(areaSlug: string, tagSlug: string): Segment | undefined {
  return CROSS_SEGMENTS.find(s => s.areaSlug === areaSlug && s.tagSlug === tagSlug)
}

/** /places の絞り込みに対応する固有ページ。canonical の寄せ先を決めるのに使う。
 *  無ければ undefined（呼び側は素の /places を canonical にする）。 */
export function segmentForFilter(pref: string, genre: string): Segment | undefined {
  if (pref && genre) return CROSS.find(s => s.pref === pref && s.genre === genre)
  if (pref) return AREA.find(s => s.pref === pref)
  if (genre) return CATEGORY.find(s => s.genre === genre)
  return undefined
}

/** その案件（県・ジャンル）から辿れる固有ページ。案件詳細の「同じ県の一覧へ」に使う */
export function segmentsForPlace(pref: string | null, genres: string[] | null): Segment[] {
  const out: Segment[] = []
  const area = pref ? AREA.find(s => s.pref === pref) : undefined
  if (area) out.push(area)
  for (const cross of CROSS) {
    if (cross.pref === pref && cross.genre && (genres ?? []).includes(cross.genre)) out.push(cross)
  }
  return out
}

/** 画面のパンくず（と BreadcrumbList）。中間URLは実在するものだけを入れる。
 *  索引ページを作らないので、パンくずにも入れない。県は3階層、cross は4階層。 */
export function segmentBreadcrumb(seg: Segment): { name: string; path: string }[] {
  const items = [
    { name: 'ホーム', path: '/' },
    { name: '出店場所を探す', path: '/places' },
  ]
  if (seg.kind === 'cross') {
    const parent = AREA.find(s => s.areaSlug === seg.areaSlug)
    if (parent) items.push({ name: parent.shortName, path: parent.path })
    const tag = CATEGORY.find(s => s.tagSlug === seg.tagSlug)
    items.push({ name: tag ? tag.shortName : seg.shortName, path: seg.path })
    return items
  }
  items.push({ name: seg.shortName, path: seg.path })
  return items
}

/** ページを作っていないカテゴリ。リンク帯で「なぜ作らないか」を画面に書くために使う。
 *  将来の担当者が同じ検討を繰り返さないようにするのが目的。 */
export const CATEGORIES_WITHOUT_PAGE: readonly string[] =
  PLACE_CATEGORIES.filter(g => !CATEGORY.some(s => s.genre === g))

/** 「飲食向け」「物販向け」は会場の種類ではなく、どんな出店者に向く募集かという適性フラグ。
 *  件数が増えてもページは作らない（県ページとほぼ同じ集合になる）。 */
export const APTITUDE_CATEGORIES: readonly string[] = ['飲食向け', '物販向け']
