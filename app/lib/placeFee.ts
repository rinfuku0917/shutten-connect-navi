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

// その形態で出られる日かどうか。曜日の指定が無ければ、案件の日程すべてが対象
export function formatAllowsDate(ff: unknown, format: string | null | undefined, date: string | null | undefined): boolean {
  const v = formatFeeOf(ff, format)
  const dows = Array.isArray(v?.dows) ? v!.dows!.filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : []
  if (dows.length === 0 || !date) return true
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return true
  return dows.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())
}
