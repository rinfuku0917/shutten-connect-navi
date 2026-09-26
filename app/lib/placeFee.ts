import { isWeekendOrHoliday } from './jpHoliday'

// 案件の出店料を計算するための、日ごとの金額の扱い。
//
// 通常は案件ごとに決めた固定額（取引先の取り分・弊社の利益）を使うが、
// 「平日2,000円・週末3,000円」のように日によって金額が変わる案件がある。
// その場合は日程（places.schedule）の各日に金額を持たせ、その日だけ
// 案件全体の固定額の代わりに使う。
//
//   schedule: [{ date, start, end, placeFee?, companyFee? }]
//     placeFee   … その日に取引先へ渡す固定額（円）
//     companyFee … その日の弊社の固定額（円）
//   どちらも未設定の日は、案件全体の設定をそのまま使う。
//
// 歩合（%）は日ごとに変えられない（売上に対する率のため、
// 日で変える必要が実務上ないため）。

export type ScheduleDay = {
  date: string
  start?: string
  end?: string
  placeFee?: number | null
  companyFee?: number | null
}

// 日ごとの金額が1日でも入っているか
export function hasPerDayFee(schedule: unknown): boolean {
  if (!Array.isArray(schedule)) return false
  return schedule.some(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))
}

// 平日／土日祝で決めた金額。祝日は土日と同じ扱いにする。
export type DayTypeFees = {
  weekday?: { placeFee?: number | null; companyFee?: number | null }
  weekend?: { placeFee?: number | null; companyFee?: number | null }
} | null

export function hasDayTypeFee(dtf: unknown): boolean {
  if (!dtf || typeof dtf !== 'object') return false
  const d = dtf as DayTypeFees
  const has = (x?: { placeFee?: number | null; companyFee?: number | null }) =>
    !!x && (typeof x.placeFee === 'number' || typeof x.companyFee === 'number')
  return has(d?.weekday) || has(d?.weekend)
}

// その日が平日か土日祝かを見て、決めてある金額を返す
export function dayTypeFee(dtf: unknown, date: string | null | undefined): { placeFee: number | null; companyFee: number | null } {
  const none = { placeFee: null, companyFee: null }
  if (!date || !hasDayTypeFee(dtf)) return none
  const d = dtf as DayTypeFees
  const side = isWeekendOrHoliday(date) ? d?.weekend : d?.weekday
  if (!side) return none
  return {
    placeFee: typeof side.placeFee === 'number' ? side.placeFee : null,
    companyFee: typeof side.companyFee === 'number' ? side.companyFee : null,
  }
}

// その日の固定額を返す。日ごとの指定が無ければ null（＝案件全体の設定を使う）
export function perDayFee(schedule: unknown, date: string | null | undefined): { placeFee: number | null; companyFee: number | null } {
  const none = { placeFee: null, companyFee: null }
  if (!date || !Array.isArray(schedule)) return none
  const d = schedule.find(x => x && x.date === date)
  if (!d) return none
  return {
    placeFee: typeof d.placeFee === 'number' ? d.placeFee : null,
    companyFee: typeof d.companyFee === 'number' ? d.companyFee : null,
  }
}

// 日ごとの金額の幅（出店者への表示に使う）。
// 例: 2,000円〜3,000円。1種類しか無ければ下限＝上限。
export function perDayFeeRange(schedule: unknown): { min: number; max: number } | null {
  if (!Array.isArray(schedule)) return null
  const totals = schedule
    .filter(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))
    .map(d => (typeof d.placeFee === 'number' ? d.placeFee : 0) + (typeof d.companyFee === 'number' ? d.companyFee : 0))
  if (totals.length === 0) return null
  return { min: Math.min(...totals), max: Math.max(...totals) }
}

// 入力された文字を金額（円）に直す。空欄は null（未設定）
export function toYen(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).replace(/[^0-9]/g, '')
  if (s === '') return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

// ===== 形態ごとの出店料と条件 =====
//
// 出店料の設定が案件に1組しかなく、キッチンカーの金額しか入れられなかった。
// 物販や催事PRは金額が違うため、概要欄に文章で書いて運用していた。
// 文章だと出店者が見落とすうえ、売上の計算にも入らない。
//
// 形態ごとに持てるようにする。未設定の案件はこれまでどおり案件全体の設定を使う。

// 申込で選べる形態。既存データには「テント」も入っているため、
// 表示のときだけ受け入れる（新しく選ばせるのは下の4つ）。
//
// 「テント・ブース」は、イベント出店で車を使わない出店のために足した。
// 区画だけ借りてテントを張る形で、キッチンカーとは料金が違う。
export const FORMATS = ['キッチンカー', '物販', '催事PR', 'テント・ブース'] as const
export type PlaceFormat = typeof FORMATS[number]

export type FormatDayFee = {
  placeFee?: number | null
  companyFee?: number | null
}

export type FormatFee = {
  /** 平日、および土日祝の額を入れていないときの額 */
  placeFee?: number | null
  companyFee?: number | null
  sharePct?: number | null
  companySharePct?: number | null
  /** 区画の条件。画面にそのまま出す（例: 3m×5m・電源あり） */
  note?: string | null
  /** 出られる曜日（0=日 … 6=土）。空なら案件の日程すべて */
  dows?: number[] | null
  /**
   * 土日祝だけ額が違う形態のための、もう一方の額。
   *
   * なぜ「平日」の欄を作らず、上の placeFee／companyFee を平日として使うのか:
   *   分けない案件のほうが多く、分けない場合に欄が2つあると
   *   どちらに入れるのか迷う。上を「金額（分けるときは平日）」、
   *   ここを「土日祝の金額」にすると、分けない案件は上だけで済み、
   *   途中で分けることにしても上に入れた値が消えない。
   *   まとめて日程追加の料金欄と同じ形にしている。
   */
  weekend?: FormatDayFee | null
  /**
   * 歩合が少ない日の最低保証。
   *
   * なぜ weekend の中に混ぜず、min として独立させたのか:
   *   FormatFeesEditor の「固定額を平日と土日祝で分ける」を外すと
   *   weekend は丸ごと削除される（画面に出ていない額で計算されるのを防ぐため）。
   *   最低保証をそこに入れると、固定額の分け方を変えただけで
   *   最低保証が黙って消えてしまう。min を別に持ち、
   *   最低保証側にも専用のチェックを持たせている。
   *
   * 中の weekend は、固定額と同じ落ち方（土日祝で空欄の項目は平日の額）。
   */
  min?: FormatMinFee | null
}

/**
 * 最低保証の額（形態ごと）。
 * 上の placeFee／companyFee が平日（分けないときは全日）、
 * weekend は土日祝だけ額が違うときにだけ入れる。
 */
export type FormatMinFee = {
  placeFee?: number | null
  companyFee?: number | null
  weekend?: FormatDayFee | null
}
export type FormatFees = Record<string, FormatFee> | null

// 形態別の設定が1つでも入っているか
export function hasFormatFees(ff: unknown): boolean {
  if (!ff || typeof ff !== 'object' || Array.isArray(ff)) return false
  return Object.keys(ff as Record<string, unknown>).length > 0
}

// その案件で受け入れている形態。未設定なら全部（これまでどおり）
export function allowedFormats(ff: unknown): string[] {
  if (!hasFormatFees(ff)) return [...FORMATS]
  const o = ff as Record<string, unknown>
  // 設定にある順ではなく、決めた並びで返す（画面の並びを揃えるため）
  const inSetting = FORMATS.filter(f => o[f])
  // 決めた3つ以外の名前（旧「テント」など）が入っていれば後ろに付ける
  const extra = Object.keys(o).filter(k => !FORMATS.includes(k as PlaceFormat))
  return [...inSetting, ...extra]
}

// その形態の設定を取り出す
export function formatFeeOf(ff: unknown, format: string | null | undefined): FormatFee | null {
  if (!format || !hasFormatFees(ff)) return null
  const o = ff as Record<string, FormatFee>
  const v = o[format]
  return v && typeof v === 'object' ? v : null
}

// その形態で、土日祝だけ別の額を入れているか
export function hasFormatWeekendFee(ff: unknown, format: string | null | undefined): boolean {
  const w = formatFeeOf(ff, format)?.weekend
  if (!w || typeof w !== 'object') return false
  return typeof w.placeFee === 'number' || typeof w.companyFee === 'number'
}

// その形態の固定額。入っていない項目は null（＝ひとつ上の設定を使う）。
//
// date を渡すと、その日が土日祝で「土日祝の金額」が入っていればそちらを返す。
// 土日祝の欄のうち片方だけ入れてある場合、入れていない側は
// 上の（平日の）額に落ちる。
export function formatFee(
  ff: unknown,
  format: string | null | undefined,
  date?: string | null,
): { placeFee: number | null; companyFee: number | null } {
  const v = formatFeeOf(ff, format)
  if (!v) return { placeFee: null, companyFee: null }
  const num = (x: unknown) => (typeof x === 'number' ? x : null)
  const flat = { placeFee: num(v.placeFee), companyFee: num(v.companyFee) }
  if (!date || !isWeekendOrHoliday(date)) return flat
  const w = v.weekend
  if (!w || typeof w !== 'object') return flat
  const p = num(w.placeFee)
  const c = num(w.companyFee)
  if (p == null && c == null) return flat
  return {
    placeFee: p != null ? p : flat.placeFee,
    companyFee: c != null ? c : flat.companyFee,
  }
}

// 出店者への表示用。曜日の並びを日→土に直す。
// 押した順に入るので、そのまま出すと「火・水・土・金」のように散らばる。
// 7日すべてなら制限が無いのと同じなので空で返す（画面に出さない）
export function sortedDows(dows: unknown): number[] {
  if (!Array.isArray(dows)) return []
  const uniq = Array.from(new Set(dows.filter(n => Number.isInteger(n) && n >= 0 && n <= 6))) as number[]
  if (uniq.length >= 7) return []
  return uniq.sort((a, b) => a - b)
}

// その形態の歩合（%）。入っていなければ null
export function formatShare(ff: unknown, format: string | null | undefined): { sharePct: number | null; companySharePct: number | null } {
  const v = formatFeeOf(ff, format)
  if (!v) return { sharePct: null, companySharePct: null }
  return {
    sharePct: typeof v.sharePct === 'number' ? v.sharePct : null,
    companySharePct: typeof v.companySharePct === 'number' ? v.companySharePct : null,
  }
}

// 歩合として使える値か（0〜100%）。
//
// 歩合の欄に金額を入れてしまった案件が実際にある
// （Olympic 国立店の催事PR に sharePct:18000 / companySharePct:7000）。
// 出店者の売上報告は計算結果をそのまま sales.total_pay に記録し、
// 請求書はそれを合算するだけなので、1件報告された時点で
// 売上5,000円が126万円の請求として確定してしまう。
// 設定ミスは無効として扱い、ひとつ上の設定（形態→案件全体）に落とす
const okPct = (x: number | null | undefined): number | null =>
  typeof x === 'number' && isFinite(x) && x >= 0 && x <= 100 ? x : null

/** その形態（無ければ案件全体）の歩合。値域の外は設定ミスとして捨てる */
export function sharePctOn(p: FeeSource, format: string | null | undefined): { placePct: number; companyPct: number } {
  const fs = formatShare(p.format_fees, format)
  return {
    placePct: okPct(fs.sharePct) ?? okPct(p.price_share_pct) ?? 0,
    companyPct: okPct(fs.companySharePct) ?? okPct(p.company_share_pct) ?? 0,
  }
}

// その形態で出られる日かどうか。曜日の指定が無ければ、案件の日程すべてが対象
export function formatAllowsDate(ff: unknown, format: string | null | undefined, date: string | null | undefined): boolean {
  const v = formatFeeOf(ff, format)
  const dows = Array.isArray(v?.dows) ? v!.dows!.filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : []
  if (dows.length === 0 || !date) return true
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return true
  return dows.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())
}

// ===== 最低保証（歩合が少ない日の下限） =====
//
// 「売上の20%。ただし売上が悪くても平日2,000円・休日7,500円はいただく」
// という案件（イオンモール与野・富谷など）を扱うために足した。
// それまでは自由文（places.fee）に書いてあるだけで、計算にも画面にも入らず、
// 請求のたびに運営が手で直していた。
//
// 決めごと:
//   ・施設へ渡す額（place）と弊社の取り分（company）で別々に持つ。
//     それぞれ「固定額＋歩合」と「最低保証」を比べて高い方を使う（合算しない）。
//   ・最低保証は「その側の請求額の下限」。固定額の外側にかけるので、
//     最低保証を後から入れても金額が下がることはない（単調に上がるだけ）。
//   ・平日と土日祝で額が違う（例: 2,000円と7,500円）ので、曜日の区別に対応する。
//     祝日・振替休日・国民の休日は土日と同じ扱い（isWeekendOrHoliday）。
//   ・平日の額が基準で、土日祝は入れてある項目だけ上書きする。
//     土日祝を空欄にした案件は、平日の額がそのまま土日祝の下限になる
//     （入力画面が「土日祝が空欄なら平日の額が使われます」と案内しているため。
//      形態ごとと案件全体で落ち方を変えない）。
//   ・入力の空欄は null（未設定）、0 は「下限なし」＝未設定と同じ扱い（> 0 で判定）。
//   ・日ごと（schedule の各日）と期間まとめ（per_event）の最低保証は持たない。
//     実データが平日／土日祝の2段階しかなく、入力欄を増やすと
//     いまどの額で計算されているのか運営が追えなくなるため。
//
// 置き場所は2つ:
//   1. 形態ごと … places.format_fees の各形態の min（列の追加なし）
//   2. 案件全体 … places.min_guarantee（jsonb。day_type_fees と同じ形）
//   1 が入っていれば 1 が優先。項目ごとに独立して落ちる。
//
// なぜ案件全体を day_type_fees に相乗りさせないのか:
//   /admin の料金設定モーダルの buildDayTypeFees が day_type_fees を
//   毎回まるごと作り直して上書きするため、同じ JSON に別の意味の値を混ぜると
//   「平日と土日祝で金額を変える」のチェックを外した瞬間に最低保証も消える。

/**
 * 案件全体の最低保証。入れ物は day_type_fees と同じ形（weekday / weekend）だが、
 * 読み出しは専用（minGuaranteeOn）。土日祝が空欄のときの落ち先が違う。
 */
export type MinGuarantee = DayTypeFees

// 最低保証は 0 を「下限なし」として扱う（計算も表示も > 0 で判定している）。
// 「入っているか」の判定も 0 を数えない。
// 数えてしまうと、0 だけが入った案件の一覧カードが自由文を捨てて
// 「（最低保証あり）」だけを出し、詳細ページには額が1円も出ない
const hasPositive = (x?: { placeFee?: number | null; companyFee?: number | null } | null): boolean =>
  !!x && typeof x === 'object'
  && ((typeof x.placeFee === 'number' && x.placeFee > 0) || (typeof x.companyFee === 'number' && x.companyFee > 0))

/** 案件全体の最低保証が入っているか */
export function hasMinGuarantee(mg: unknown): boolean {
  if (!mg || typeof mg !== 'object') return false
  const d = mg as DayTypeFees
  return hasPositive(d?.weekday) || hasPositive(d?.weekend)
}

/** その形態に最低保証が入っているか */
export function hasFormatMin(ff: unknown, format: string | null | undefined): boolean {
  const m = formatFeeOf(ff, format)?.min
  if (!m || typeof m !== 'object') return false
  return hasPositive(m) || hasPositive(m.weekend)
}

/**
 * その形態の最低保証。入っていない項目は null（＝案件全体の設定に落ちる）。
 * date を渡すと、その日が土日祝で「土日祝の最低保証」が入っていればそちらを返す。
 * 固定額（formatFee）と同じ落ち方で、土日祝で空欄にした項目は平日の額を使う。
 */
export function formatMin(
  ff: unknown,
  format: string | null | undefined,
  date?: string | null,
): { placeFee: number | null; companyFee: number | null } {
  return twoSidedMin(formatFeeOf(ff, format)?.min, date)
}

/**
 * 案件全体の最低保証（places.min_guarantee）のその日の額。
 *
 * 固定額の dayTypeFee ではなく専用にしているのは、空欄の落ち先が違うから。
 * 固定額は平日と土日祝が別々の設定で、片方が空なら「その日は上の設定へ落ちる」。
 * 最低保証は「平日の額が基準で、土日祝だけ違うときに上書きする」形にしている
 * （形態ごとの最低保証＝formatMin と同じ。入力画面もそう案内している:
 *  「土日祝が空欄なら平日の額が使われます」）。
 * dayTypeFee で読んでいたときは、案内どおり平日だけ入れると
 * 土日祝が下限なしになり、最低保証がいちばん高い日（与野は休日7,500円）に効かなかった。
 */
export function minGuaranteeOn(mg: unknown, date?: string | null): { placeFee: number | null; companyFee: number | null } {
  if (!mg || typeof mg !== 'object') return { placeFee: null, companyFee: null }
  return twoSidedMin(mg as MinSrc, date)
}

// 最低保証の入れ物。形態ごと（FormatMinFee）は直下が平日の額、
// 案件全体（MinGuarantee）は weekday の中が平日の額で、どちらも weekend が土日祝
type MinSrc = {
  placeFee?: number | null
  companyFee?: number | null
  weekday?: FormatDayFee | null
  weekend?: FormatDayFee | null
}

// 「平日の額が基準、土日祝は入っている項目だけ上書き」の読み出し
function twoSidedMin(
  src: MinSrc | null | undefined,
  date?: string | null,
): { placeFee: number | null; companyFee: number | null } {
  if (!src || typeof src !== 'object') return { placeFee: null, companyFee: null }
  const num = (x: unknown) => (typeof x === 'number' ? x : null)
  // 案件全体は weekday の中、形態ごとは直下に平日の額が入っている
  const base = src.weekday && typeof src.weekday === 'object' ? src.weekday : src
  const flat = { placeFee: num(base.placeFee), companyFee: num(base.companyFee) }
  // 日付が無い場面（/admin の売上プレビューなど）も平日の額で答える。
  // 下限なしにすると、日を選ぶまで下限抜きの額が出てしまう
  if (!date || !isWeekendOrHoliday(date)) return flat
  const w = src.weekend
  if (!w || typeof w !== 'object') return flat
  const p = num(w.placeFee)
  const c = num(w.companyFee)
  if (p == null && c == null) return flat
  return {
    placeFee: p != null ? p : flat.placeFee,
    companyFee: c != null ? c : flat.companyFee,
  }
}

/**
 * その日の最低保証（形態ごと → 案件全体。項目ごとに独立して落ちる）。
 * dayFeeOf・注記・入力画面の例示はすべてここを通す（落ち方を1本にするため）。
 */
export function minFeeOn(
  p: FeeSource,
  format: string | null | undefined,
  date?: string | null,
): { placeFee: number | null; companyFee: number | null } {
  const fm = formatMin(p.format_fees, format, date)
  const mg = minGuaranteeOn(p.min_guarantee, date)
  // 最低保証が意味を持つのは歩合のある側だけ。
  //
  // 固定額の出店料は、売上が低くても高くても同じ額なので
  // 「売上が少ない日の下限」という考え方が無い（2026-09-21 の指示）。
  // 欄は自由入力のままなので、固定額だけの案件に数字が入ることは起こりうる。
  // そのまま高い方を採ると、契約と違う額を請求してしまう。
  // ここで落としておけば、計算・案件ページの注記・請求件名・入力画面の例示が
  // すべて同じ判断になる（minFeeOn を通さない読み出しを作らないこと）。
  const { placePct, companyPct } = sharePctOn(p, format)
  return {
    placeFee: placePct > 0 ? (fm.placeFee != null ? fm.placeFee : mg.placeFee) : null,
    companyFee: companyPct > 0 ? (fm.companyFee != null ? fm.companyFee : mg.companyFee) : null,
  }
}

// 形態ごとの設定に入力チェックは置かない。
//
// 金額も歩合も自由入力にする方針（2026-09-21 の指示）。
// 案件ごとの条件は運営が契約どおりに入れるので、
// サイト側で範囲を決めて保存を止めたり、赤字で注意を出したりはしない。
// 誤って歩合の欄に金額が入っていても請求額が壊れないよう、
// 計算側で値域の外を捨てる（上の okPct）方で守っている。

// ===== 出店料の計算（ここだけ。呼ぶ側で足し算をしない） =====
//
// 以前は同じ優先順位と同じ式が4か所に写してあった
// （運営の calcFees・出店者の calcFee・案件詳細の1日ごとの表示・請求件名）。
// 出店者側だけ形態ごとの歩合（formatShare）を見ておらず、
// 形態と案件で歩合が違う案件では、出店者の画面の額と請求額がずれていた。
// 計算はこの関数に集める。

/** 計算に必要な案件の設定。places の行、または申込に写した同じ項目を渡す */
export type FeeSource = {
  price_fixed?: number | null
  price_share_pct?: number | null
  place_fixed_unit?: string | null
  company_fixed_amount?: number | null
  company_fixed_unit?: string | null
  company_share_pct?: number | null
  share_tax_basis?: string | null
  share_tax_rate?: number | null
  /** 日程（places.schedule）。日ごとの額を見る */
  schedule?: unknown
  /** 案件の平日／土日祝の額（places.day_type_fees） */
  day_type_fees?: unknown
  /** 形態ごとの額と歩合と最低保証（places.format_fees） */
  format_fees?: unknown
  /** 案件全体の最低保証（places.min_guarantee）。列が無い環境では undefined */
  min_guarantee?: unknown
  /**
   * 日数ごとの額（places.day_count_fees）。
   * 日ごとの計算には入らない（日数が決まって初めて額が決まるため）。
   * 入っている案件は、この表にある日数だけが選べる
   */
  day_count_fees?: unknown
}

export type DayFee = {
  /** 歩合の計算元（税抜に換算する設定ならその額） */
  base: number
  basis: string
  rate: number
  placeFee: number
  companyFee: number
  total: number
  /** その額が最低保証で決まったか（画面の注記と請求件名に使う） */
  placeMinApplied: boolean
  companyMinApplied: boolean
}

/**
 * その日の出店料。運営・出店者・案件詳細・請求件名はすべてこれを呼ぶ。
 *
 * 固定額の優先順位（項目ごとに独立して落ちる）:
 *   形態ごとの額（土日祝を分けていればその日に合う額）
 *   → 日程に入れたその日の額 → 案件の平日／土日祝の額 → 案件全体の固定額
 *   （単位が「期間で1回」の固定額は、日ごとの計算では0として扱う）
 *
 *   形態をいちばん強くしているのは、形態に金額を入れたらそちらが効くのが
 *   入力した人の期待に合うため（日程の金額はキッチンカー向けに入れたもの）。
 *
 * 歩合: 形態ごと → 案件全体
 * 最低保証: 形態ごと → 案件全体。側ごとに「固定額＋歩合」と比べて高い方を使う
 *
 * @param taxOverride 売上を入れるときの上書き（'ex8' / 'ex10' / 'as_entered'）
 * @param baseOverride 歩合の計算元を直接渡す（税率ごとに分けて入力した場合など）
 */
export function dayFeeOf(
  p: FeeSource,
  format: string | null | undefined,
  date: string | null | undefined,
  revenue: number,
  taxOverride: string = '',
  baseOverride: number | null = null,
): DayFee {
  const ov = taxOverride
  const rate = ov === 'ex8' ? 8 : ov === 'ex10' ? 10 : (p.share_tax_rate || 8)
  const basis = ov === 'ex8' || ov === 'ex10' ? 'tax_excluded'
    : ov === 'as_entered' ? 'as_entered'
    : (p.share_tax_basis || 'as_entered')
  const base = baseOverride != null ? baseOverride
    : (basis === 'tax_excluded' ? Math.floor(revenue / (1 + rate / 100)) : revenue)

  // 固定額
  const fmt = formatFee(p.format_fees, format, date)
  const day = perDayFee(p.schedule, date)
  const dt = dayTypeFee(p.day_type_fees, date)
  const placeFixed = fmt.placeFee != null ? fmt.placeFee
    : day.placeFee != null ? day.placeFee
    : dt.placeFee != null ? dt.placeFee
    : (p.place_fixed_unit === 'per_event' ? 0 : (p.price_fixed || 0))
  const companyFixed = fmt.companyFee != null ? fmt.companyFee
    : day.companyFee != null ? day.companyFee
    : dt.companyFee != null ? dt.companyFee
    : (p.company_fixed_unit === 'per_event' ? 0 : (p.company_fixed_amount || 0))

  // 歩合（形態ごとに変えられる。物販は固定額のみ、キッチンカーは歩合ありなど）
  const { placePct, companyPct } = sharePctOn(p, format)

  // 最低保証（形態ごと → 案件全体）
  const min = minFeeOn(p, format, date)
  const minPlace = min.placeFee
  const minCompany = min.companyFee

  // 側ごとに比べて高い方を使う（合算にはしない）。
  // 丸めの位置は、これまでの運営側の計算（Math.floor(固定額 + 元 × %)）と揃える。
  // 位置を変えると、形態の金額に小数を入れてある案件で1円ずれる
  const rawPlace = Math.floor(placeFixed + base * placePct / 100)
  const rawCompany = Math.floor(companyFixed + base * companyPct / 100)
  // 0 は「下限なし」なので比べない（未設定と同じ動き）。
  // 歩合の無い側は minFeeOn が null を返すので、ここでは見なくてよい
  const usePlaceMin = minPlace != null && minPlace > 0
  const useCompanyMin = minCompany != null && minCompany > 0
  const placeFee = usePlaceMin ? Math.max(rawPlace, minPlace as number) : rawPlace
  const companyFee = useCompanyMin ? Math.max(rawCompany, minCompany as number) : rawCompany

  return {
    base, basis, rate,
    placeFee, companyFee, total: placeFee + companyFee,
    // ちょうど同額の日は「歩合で決まった」として扱う（> で比べる）。
    // >= にすると、出店者の売上報告に
    // 「※ 歩合で計算した額が最低保証を下回るため」という事実と違う説明が出て、
    // 請求件名も「最低保証◯円」に変わってしまう
    placeMinApplied: usePlaceMin && (minPlace as number) > rawPlace,
    companyMinApplied: useCompanyMin && (minCompany as number) > rawCompany,
  }
}

// ===== 出店料の条件を文字にする（画面と請求件名で同じ言い方にするため） =====

/** 平日と土日祝の2段階で持つ、表示用の額 */
type TwoSides = { weekday: number | null; weekend: number | null }

// 表示用に「平日のとき」「土日祝のとき」の額を読み出すための見本の日付。
// 落ち方（土日祝で空欄の項目は平日の額）を計算と1本にするため、
// 表示側も日付から読む形にしている。
// 6月は祝日が1日も無いので、何年経っても平日／日曜の判定が変わらない。
const SAMPLE_WEEKDAY = '2026-06-03' // 水曜
const SAMPLE_WEEKEND = '2026-06-07' // 日曜

const sideTotal = (a: { placeFee: number | null; companyFee: number | null }): number | null =>
  a.placeFee == null && a.companyFee == null ? null : (a.placeFee ?? 0) + (a.companyFee ?? 0)

/**
 * その案件（形態を選んでいればその形態）の最低保証を、
 * 平日・土日祝の合計額（出店者が払う額）で返す。
 * 土日祝は、平日の日付と土日祝の日付を1つずつ当てて読み出す
 * （落ち方を dayFeeOf と1本にするため、日付から読む形にしている）。
 */
export function minSides(p: FeeSource, format?: string | null): TwoSides {
  // 落ち方を dayFeeOf と揃えるため、見本の日付で minFeeOn から読む
  const read = (date: string): number | null => {
    const t = sideTotal(minFeeOn(p, format, date))
    return t != null && t > 0 ? t : null
  }
  return { weekday: read(SAMPLE_WEEKDAY), weekend: read(SAMPLE_WEEKEND) }
}

const yen = (n: number) => n.toLocaleString() + '円'

/**
 * 入力欄の値から、保存用の最低保証（places.min_guarantee）を作る。
 * 運営の料金設定モーダルと、募集者の新規作成・編集画面が同じ形を作るよう、
 * 組み立てはここに置く。
 *
 * 0 は「下限なし」＝未設定と同じ動きなので落とす。
 * 何も入っていなければ null（＝列から消す）。
 */
export function buildMinGuaranteeJson(v: {
  weekdayPlaceFee?: number | null
  weekdayCompanyFee?: number | null
  weekendPlaceFee?: number | null
  weekendCompanyFee?: number | null
}): Record<string, unknown> | null {
  const n = (x: number | null | undefined) => (typeof x === 'number' && isFinite(x) && x > 0 ? Math.round(x) : null)
  const side = (pf: number | null | undefined, cf: number | null | undefined) => {
    const o: Record<string, number> = {}
    const a = n(pf), b = n(cf)
    if (a != null) o.placeFee = a
    if (b != null) o.companyFee = b
    return Object.keys(o).length ? o : null
  }
  const wd = side(v.weekdayPlaceFee, v.weekdayCompanyFee)
  const we = side(v.weekendPlaceFee, v.weekendCompanyFee)
  if (!wd && !we) return null
  const out: Record<string, unknown> = {}
  if (wd) out.weekday = wd
  if (we) out.weekend = we
  return out
}

/** その日の最低保証の合計（出店者が払う下限）。入っていなければ null */
export function minTotalOn(p: FeeSource, format: string | null | undefined, date: string | null | undefined): number | null {
  const t = sideTotal(minFeeOn(p, format, date))
  return t != null && t > 0 ? t : null
}

/**
 * 最低保証の注記（例: 「最低2,000円/日」「最低 平日2,000円/日・土日祝7,500円/日」）。
 * date を渡すと、その日の額だけを出す（請求書の1行＝1日など、日が決まっている場面）。
 */
export function minNoteOf(p: FeeSource, format?: string | null, prefix = '最低', date?: string | null): string {
  if (date) {
    const one = minTotalOn(p, format, date)
    return one == null ? '' : prefix + yen(one)
  }
  const { weekday, weekend } = minSides(p, format)
  if (weekday == null && weekend == null) return ''
  if (weekday != null && weekend != null && weekday !== weekend) {
    return prefix + ' 平日' + yen(weekday) + '/日・土日祝' + yen(weekend) + '/日'
  }
  const one = weekday ?? weekend
  return one == null ? '' : prefix + yen(one) + '/日'
}

/** 「期間で1回」の単位と「日ごとの金額」が同時に入っている状態。
 *  入っていると日ごとの金額が優先され、日数分が請求される */
export type PerEventConflict = {
  /** 1日あたりとして計算される額（施設＋弊社） */
  dayTotal: number
  /** 日程に入っている日数 */
  days: number
  /** そのまま全日申し込まれたときの請求額 */
  wouldCharge: number
  /** どこに日額が入っているか（画面の案内に使う） */
  where: string[]
}

/** 日数ごとの出店料の1行（places.day_count_fees の値） */
export type DayCountFee = {
  placeFee?: number | null
  companyFee?: number | null
}

/**
 * 日数ごとの出店料（「2日なら6万円、3日なら8万円」）を読む。
 *
 * なぜ要るか（2026-09-26 の運営からの相談）:
 *   美食EXPO のような催しは1日だけの出店を受け付けず、2日か3日で出る。
 *   しかも日数で金額が変わる。「1日あたり」だと2日6万→3日9万になり、
 *   「期間で1回」だと2日も3日も同じ額になる。どちらでも表せなかった。
 *
 * この表が入っている案件は、表にある日数だけが選べる（＝申込の決まりにもなる）。
 * 日ごとの計算（dayFeeOf）はこの表を見ない。日数が決まって初めて額が決まるため。
 */
export function dayCountOptions(p: FeeSource): number[] {
  const o = p.day_count_fees
  if (!o || typeof o !== 'object' || Array.isArray(o)) return []
  return Object.keys(o as Record<string, unknown>)
    .map(k => parseInt(k, 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
}

/** その日数の額（施設分＋弊社分の合計）。表に無い日数は null */
export function dayCountFeeOf(p: FeeSource, days: number): number | null {
  const o = p.day_count_fees
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const v = (o as Record<string, DayCountFee>)[String(days)]
  if (!v || typeof v !== 'object') return null
  const total = (Number(v.placeFee) || 0) + (Number(v.companyFee) || 0)
  return total > 0 ? total : null
}

/** 画面に出す「2日 60,000円／3日 80,000円」の文。表が無ければ空 */
export function dayCountFeeText(p: FeeSource): string {
  return dayCountOptions(p)
    .map(n => {
      const t = dayCountFeeOf(p, n)
      return t == null ? '' : `${n}日 ${yen(t)}`
    })
    .filter(Boolean)
    .join('／')
}

/**
 * 「期間で1回のみ」として入れてある額の合計（施設分＋弊社分）。
 *
 * 日ごとの計算（dayFeeOf）はこの額を0として捨てるので、日数ぶん増えない。
 * 申込のカレンダーの合計と請求は、この額を日数によらず1回だけ足す。
 * 画面側で price_fixed と company_fixed_amount を手で足さないよう、ここに置く。
 */
export function perEventFeeOf(p: FeeSource): number {
  return (p.place_fixed_unit === 'per_event' ? (p.price_fixed || 0) : 0)
    + (p.company_fixed_unit === 'per_event' ? (p.company_fixed_amount || 0) : 0)
}

/**
 * 「期間で1回」と「日ごとの金額」の同時入力を見つける。
 *
 * なぜ要るか（2026-09-25 の事故）:
 *   美食EXPO in三重（3日間で80,000円）で、案件全体は「期間で1回 80,000円」と
 *   正しく設定されていたのに、形態ごとと日程ごとにも 60,000＋20,000 が入っていた。
 *   計算（dayFeeOf）は 形態 → 日程 → 平日/土日祝 → 案件全体 の順に見るので、
 *   形態の額が勝ち、3日申し込むと 80,000×3＝240,000円（本来の3倍）になっていた。
 *   単位（per_event）を持てるのは案件全体だけで、形態と日程の金額は必ず
 *   「1日あたり」として扱われる。この食い違いは画面からは見えないため、
 *   入力した時点で気づけるようにする。
 *
 * 見つけても保存は止めない（料金の欄は自由入力のまま、という決めごとに合わせる）。
 * 気づくための案内だけを出す。
 */
export function perEventConflict(p: FeeSource): PerEventConflict | null {
  const perEvent = p.place_fixed_unit === 'per_event' || p.company_fixed_unit === 'per_event'
  if (!perEvent) return null

  const where: string[] = []
  // 形態ごとの金額（平日・土日祝のどちらでも）
  const ff = p.format_fees
  if (ff && typeof ff === 'object') {
    for (const [name, v] of Object.entries(ff as Record<string, FormatFee>)) {
      const has = (x: unknown) => typeof x === 'number' && x > 0
      const w = v?.weekend
      if (has(v?.placeFee) || has(v?.companyFee) || has(w?.placeFee) || has(w?.companyFee)) {
        where.push(`形態「${name}」の金額`)
      }
    }
  }
  // 日程ごとの金額
  const sch = Array.isArray(p.schedule) ? (p.schedule as ScheduleDay[]) : []
  if (sch.some(d => (typeof d?.placeFee === 'number' && d.placeFee > 0) || (typeof d?.companyFee === 'number' && d.companyFee > 0))) {
    where.push('日程ごとの金額')
  }
  // 平日／土日祝の金額
  if (hasDayTypeFee(p.day_type_fees)) where.push('平日・土日祝の金額')

  if (where.length === 0) return null

  // 実際にいくら請求されるか。1日目の額を代表に取る（日ごとに違えば合計で見る）
  const days = sch.filter(d => d?.date).length
  const dayOf = (date: string | null) => {
    const fmt = formatFee(p.format_fees, firstFormatName(p.format_fees), date)
    const day = perDayFee(p.schedule, date)
    const dt = dayTypeFee(p.day_type_fees, date)
    const place = fmt.placeFee ?? day.placeFee ?? dt.placeFee ?? 0
    const company = fmt.companyFee ?? day.companyFee ?? dt.companyFee ?? 0
    return place + company
  }
  const totals = sch.filter(d => d?.date).map(d => dayOf(d.date))
  const wouldCharge = totals.reduce((a, b) => a + b, 0)
  const dayTotal = totals.length > 0 ? Math.max(...totals) : dayOf(null)
  if (dayTotal <= 0) return null
  return { dayTotal, days, wouldCharge, where }
}

/** 形態ごとの設定の先頭の名前。同時入力の検査で「代表の額」を見るのに使う */
function firstFormatName(ff: unknown): string | null {
  if (!ff || typeof ff !== 'object') return null
  const keys = Object.keys(ff as Record<string, unknown>)
  return keys.length > 0 ? keys[0] : null
}

/** カレンダーの1マスに出す、その日1日分の出店料 */
export type DayFeeLabel = {
  /** その日に払う額（円）。売上に応じて決まる日・「期間で1回」の案件は null */
  amount: number | null
  /** amount が null のときにマスへ出す短い語（「歩合」「期間」「相談」） */
  short: string
  /** amount のうしろに付ける印。'＋' は歩合も加わる日、'最' は最低保証で決まる日 */
  mark: string
  /** 全文（「4,500円/日 ＋ 売上の20%（最低2,000円）」）。選んだ日の一覧に出す */
  text: string
}

/**
 * その日1日分の出店料を、売上が決まる前（申込の時点）に画面へ出すための値。
 *
 * 額は dayFeeOf に売上0を渡して作る＝「売上が立たなくてもこの額」。
 * 事前請求の初期額（app/components/PlaceApplicationsModal.tsx）と同じ関数なので、
 * カレンダーで見た額と、あとから届く請求の額が食い違わない。
 *
 * 以前は案件詳細が独自の短い式（形態 → 日程の各日 → 平日/土日祝）で出しており、
 * 案件全体の固定額（price_fixed）だけを入れた案件では1日ごとの額が出なかった。
 */
export function dayFeeLabelOn(p: FeeSource, format: string | null | undefined, date: string): DayFeeLabel {
  const { parts, minNote, empty } = feeCondition(p, format, date)
  const text = empty ? '要相談' : parts.join(' ＋ ') + (minNote ? '（' + minNote + '）' : '')

  const day = dayFeeOf(p, format, date, 0)
  const { placePct, companyPct } = sharePctOn(p, format)
  const pct = placePct + companyPct
  // 「期間で1回」の固定額は日ごとの計算では0。日数分を足すと請求額と食い違うので、
  // 額としては出さず「期間」と出す（合計にも入れない）
  const perEvent = (p.place_fixed_unit === 'per_event' && (p.price_fixed || 0) > 0)
    || (p.company_fixed_unit === 'per_event' && (p.company_fixed_amount || 0) > 0)
  // 日数ごとの金額の案件は、1日ぶんの額が存在しない（日数が決まって初めて決まる）
  const byCount = dayCountOptions(p).length > 0
  const amount = day.total > 0 ? day.total : null
  const minApplied = day.placeMinApplied || day.companyMinApplied
  return {
    amount,
    short: amount != null ? '' : (byCount ? '日数' : pct > 0 ? '歩合' : perEvent ? '期間' : '相談'),
    mark: amount == null ? '' : minApplied ? '最' : pct > 0 ? '＋' : '',
    text,
  }
}

export type FeeCondition = {
  /** 「3,000円/日」「売上の20%」など。画面では ＋ でつないで出す */
  parts: string[]
  /** 「最低2,000円/日」。入っていなければ空 */
  minNote: string
  /** 計算の設定が何も入っていない（自由文 places.fee を出す合図） */
  empty: boolean
}

/**
 * 出店者に見せる出店料の条件。案件一覧・案件詳細・申込モーダル・請求件名が
 * 同じ言い方になるよう、文の組み立てをここに集める。
 * 金額は place＋company の合計（内訳は出店者に見せない）。
 *
 * format を渡すと、その形態の設定（固定額・歩合・最低保証）で作る。
 * date を渡すと、平日／土日祝を並べずにその日の額だけを出す
 * （請求書の1行は1日なので、2種類を並べると件名が読めなくなる）。
 */
export function feeCondition(p: FeeSource, format?: string | null, date?: string | null): FeeCondition {
  const parts: string[] = []

  // 固定額。優先順位は dayFeeOf と同じ（形態 → 日程の各日 → 案件の平日土日 → 案件全体）
  const fmtWd = formatFee(p.format_fees, format, SAMPLE_WEEKDAY)
  const fmtWe = formatFee(p.format_fees, format, SAMPLE_WEEKEND)
  const dtWd = dayTypeFee(p.day_type_fees, SAMPLE_WEEKDAY)
  const dtWe = dayTypeFee(p.day_type_fees, SAMPLE_WEEKEND)
  const range = perDayFeeRange(p.schedule)
  const fmtWdT = sideTotal(fmtWd)
  const fmtWeT = sideTotal(fmtWe)
  const dtWdT = sideTotal(dtWd)
  const dtWeT = sideTotal(dtWe)
  // 案件全体の固定額。施設分と弊社分は単位を別々に持てるので、1つの数字にまとめない。
  //
  // まとめていたときに何が起きたか（2026-09-25 の運営からの指摘）:
  //   施設60,000円/日 ＋ 弊社20,000円/期間 と入れた案件が「60,000円/期間」と表示され、
  //   弊社分が消えたうえ、日額に「/期間」の単位が付いていた。
  //   逆の組み合わせでは「20,000円/期間」と、日額のほうだけが出ていた。
  //   片方だけ「期間で1回のみ」にした案件は、どの組み合わせでも嘘の額になっていた。
  const placesFixed = (p.place_fixed_unit === 'per_event' ? 0 : (p.price_fixed || 0))
    + (p.company_fixed_unit === 'per_event' ? 0 : (p.company_fixed_amount || 0))
  const placesPerEvent = (p.place_fixed_unit === 'per_event' ? (p.price_fixed || 0) : 0)
    + (p.company_fixed_unit === 'per_event' ? (p.company_fixed_amount || 0) : 0)

  const perDay = (t: number) => yen(t) + '/日'
  // 「期間で1回のみ」の額。日ごとの計算には入らない（dayFeeOf が0を返す）ので、
  // 日額とは別の項として添える
  const perEventText = placesPerEvent > 0 ? yen(placesPerEvent) + '/期間' : ''
  const twoSided = (wd: string, we: string) => '平日' + wd + ' ／ 土日祝' + we
  const rangeText = range
    ? (range.min === range.max ? perDay(range.min) : yen(range.min) + '〜' + yen(range.max) + '/日')
    : ''
  // 案件全体の列の額（日ごとの計算では「期間で1回」の固定額を0として扱う）
  const colText = placesFixed > 0 ? perDay(placesFixed) : ''
  // 片側だけ額を入れてある案件（形態や案件の平日土日で「土日祝だけ」入力など）は、
  // 入れていない側だけが下の優先順位へ落ちる（dayFeeOf と同じ）。
  // ここで 0 を当てると「平日0円/日」と告知してしまい、実際の請求額と食い違う
  const belowFormat = (dtT: number | null) => rangeText || (dtT != null ? perDay(dtT) : colText)

  // 日数ごとの額を入れてある案件は、それが唯一の額。
  // 「1日あたり」も「期間で1回」も出さない（日数が決まって初めて額が決まるため）
  const byCount = dayCountFeeText(p)
  if (byCount) {
    parts.push(byCount)
  } else if (date) {
    // 日が決まっている場面（請求書の1行）は、その日の額だけを出す
    const fmtD = sideTotal(formatFee(p.format_fees, format, date))
    const dayD = sideTotal(perDayFee(p.schedule, date))
    const dtD = sideTotal(dayTypeFee(p.day_type_fees, date))
    const one = fmtD != null ? fmtD : dayD != null ? dayD : dtD != null ? dtD : (placesFixed > 0 ? placesFixed : null)
    if (one != null && one > 0) parts.push(perDay(one))
  } else if (fmtWdT != null || fmtWeT != null) {
    const wd = fmtWdT != null ? perDay(fmtWdT) : belowFormat(dtWdT)
    const we = fmtWeT != null ? perDay(fmtWeT) : belowFormat(dtWeT)
    if (wd !== we) parts.push(twoSided(wd || perDay(0), we || perDay(0)))
    else if (wd && wd !== perDay(0)) parts.push(wd)
  } else if (range) {
    parts.push(rangeText)
  } else if (dtWdT != null || dtWeT != null) {
    const wd = dtWdT != null ? perDay(dtWdT) : colText
    const we = dtWeT != null ? perDay(dtWeT) : colText
    if (wd !== we) parts.push(twoSided(wd || perDay(0), we || perDay(0)))
    else if (wd && wd !== perDay(0)) parts.push(wd)
  } else if (placesFixed > 0) {
    parts.push(perDay(placesFixed))
  }

  // 「期間で1回のみ」の額は、上のどの枝を通っても日額とは別に添える。
  // 形態ごとの日額と併用している案件もあるため、枝の中に入れない。
  // 日数ごとの表がある案件は、そちらが唯一の額なので足さない
  if (perEventText && !byCount) parts.push(perEventText)

  // 歩合（計算と同じ読み出し。値域の外は設定ミスとして捨てる）
  const { placePct, companyPct } = sharePctOn(p, format)
  const pct = placePct + companyPct
  if (pct > 0) parts.push('売上の' + pct + '%')

  const minNote = minNoteOf(p, format, '最低', date)
  return { parts, minNote, empty: parts.length === 0 && minNote === '' }
}
