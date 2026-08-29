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
