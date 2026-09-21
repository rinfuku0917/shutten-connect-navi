// 日本の祝日の判定。
//
// 出店料が「平日」と「土日祝」で分かれている案件があるため、
// 売上の日付から、その日が平日なのか土日祝なのかを判定する。
// 毎年カレンダーを更新しなくて済むよう、計算で求めている。
//
// 春分・秋分は近似式（1980〜2099年で正しい値になる）を使う。
// 振替休日（祝日が日曜のとき翌平日が休み）と
// 国民の休日（前日と翌日がどちらも祝日の平日）にも対応する。

const HAPPY_MONDAY = [
  { m: 1, n: 2 },   // 成人の日（1月第2月曜）
  { m: 7, n: 3 },   // 海の日（7月第3月曜）
  { m: 9, n: 3 },   // 敬老の日（9月第3月曜）
  { m: 10, n: 2 },  // スポーツの日（10月第2月曜）
]

const FIXED: Record<number, number[]> = {
  1: [1],            // 元日
  2: [11, 23],       // 建国記念の日 / 天皇誕生日
  4: [29],           // 昭和の日
  5: [3, 4, 5],      // 憲法記念日 / みどりの日 / こどもの日
  8: [11],           // 山の日
  11: [3, 23],       // 文化の日 / 勤労感謝の日
}

// 春分の日・秋分の日（1980〜2099年）
function equinox(year: number, month: number): number | null {
  if (year < 1980 || year > 2099) return null
  if (month === 3) return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
  if (month === 9) return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
  return null
}

// 振替休日を考えないその日単体の祝日判定
function isHolidayBase(y: number, m: number, d: number, dow: number): boolean {
  if ((FIXED[m] || []).includes(d)) return true
  if (equinox(y, m) === d) return true
  for (const h of HAPPY_MONDAY) {
    if (h.m === m && dow === 1 && Math.ceil(d / 7) === h.n) return true
  }
  return false
}

// その日単体が祝日か（Date から見る版。国民の休日の前後日の判定に使う）
function isHolidayBaseAt(dt: Date): boolean {
  return isHolidayBase(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), dt.getUTCDay())
}

// 「YYYY-MM-DD」がその年の祝日か（振替休日・国民の休日を含む）
export function isJapaneseHoliday(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (isNaN(dt.getTime())) return false
  const dow = dt.getUTCDay()

  if (isHolidayBase(y, m, d, dow)) return true

  // 国民の休日：前日と翌日の両方が祝日なら、挟まれた平日も休み。
  // 例）2026-09-22（火）は敬老の日（21日）と秋分の日（23日）に挟まれる。
  // 年ごとの一覧ではなく規則で入れているのは、9月のシルバーウィークが
  // 2026・2032・2037 …と繰り返し発生するため。
  // 最低保証は平日2,000円・土日祝7,500円のように3倍以上ちがう案件があり、
  // この1日を平日と判定すると1日あたり5,500円取りこぼす
  if (dow !== 0 && dow !== 6
    && isHolidayBaseAt(new Date(dt.getTime() - 86400000))
    && isHolidayBaseAt(new Date(dt.getTime() + 86400000))) return true

  // 振替休日：さかのぼって日曜の祝日があり、その間がすべて祝日なら休み
  if (dow !== 0) {
    for (let back = 1; back <= 3; back++) {
      const p = new Date(dt.getTime() - back * 86400000)
      const py = p.getUTCFullYear(), pm = p.getUTCMonth() + 1, pd = p.getUTCDate()
      if (!isHolidayBase(py, pm, pd, p.getUTCDay())) break
      if (p.getUTCDay() === 0) return true
    }
  }
  return false
}

// その日が「土日祝」かどうか。false なら平日。
export function isWeekendOrHoliday(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dow === 0 || dow === 6) return true
  return isJapaneseHoliday(iso)
}

// 表示用のラベル
export function dayTypeLabel(iso: string): '平日' | '土日祝' {
  return isWeekendOrHoliday(iso) ? '土日祝' : '平日'
}
