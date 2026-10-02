// 月のカレンダーの骨組み。日付の計算だけを持つ（描画は app/components/MonthGrid.tsx）。
//
// ここが唯一の正で、カレンダーを描く画面が同じものを読む：
//   ・app/components/ApplyDateCalendar.tsx   … 出店者が申し込む画面
//   ・app/admin/ScheduleCalendar.tsx         … 運営の出店管理
//   ・app/dashboard/seller/page.tsx          … 出店者マイページの出店カレンダー
//   ・app/dashboard/host/                    … 募集者の画面（2026-10 に新設）
//
// なぜ要るか（2026-10-02 の運営からの依頼）:
//   カレンダーが3画面にあり、どれも別に書かれていた。
//   「同じ見た目・同じ操作にしてほしい」という依頼を受けたが、
//   先頭の空白の作り方・月末の日数・日付キーの作り方まで3通りに
//   書かれていたので、まず計算をここに1本化する。
//
//   3つとも同じだったこと（調べて確認した）:
//     ・週は日曜始まり
//     ・先頭にだけ空白のマスを置く。月末の後ろには置かない
//     ・曜日の色は 日=#DC2626 / 土=#1D4ED8 / ほか=#64748B
//
// 日付は「日本の日付」で扱う。
//   案件の日程・申込日・売上日はすべて日本の日付で入っている。
//   new Date() は実行環境の時間帯で動くので、月の判定には使わない。

/** 月。m は 0〜11（JavaScript の getMonth と同じ） */
export type YearMonth = { y: number; m: number }

/** 曜日の文字。添字は 0=日 … 6=土 */
export const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
/** 曜日の色。日と土だけ変える（3画面で同じ値だった） */
export const DOW_COLORS = ['#DC2626', '#64748B', '#64748B', '#64748B', '#64748B', '#64748B', '#1D4ED8'] as const

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 日本時間の今日（YYYY-MM-DD）。サーバーがUTCで動くため、+9時間して日付を取る */
export function todayJst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 日本時間の今月 */
export function thisMonthJst(): YearMonth {
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}

/** 「2026-10」の形。月の見出しや並べ替えのキーに使う */
export function monthKey(ym: YearMonth): string {
  return `${ym.y}-${pad2(ym.m + 1)}`
}

/** 「2026-10-06」から月を取り出す */
export function monthOfDate(date: string): YearMonth | null {
  const [y, m] = String(date).slice(0, 10).split('-').map(Number)
  if (!y || !m) return null
  return { y, m: m - 1 }
}

/** 「2026年10月」の形。3画面とも同じ書き方だった */
export function monthLabel(ym: YearMonth): string {
  return `${ym.y}年${ym.m + 1}月`
}

/** n か月ずらす。年をまたぐ計算を自分で書かないために通す */
export function shiftMonth(ym: YearMonth, n: number): YearMonth {
  const t = ym.y * 12 + ym.m + n
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }
}

/** 月の比較。a が b より前なら負、同じなら0、後なら正 */
export function compareMonth(a: YearMonth, b: YearMonth): number {
  return (a.y * 12 + a.m) - (b.y * 12 + b.m)
}

/** その月の1日が何曜日か（0=日） */
export function firstDowOf(ym: YearMonth): number {
  return new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay()
}

/** その月の日数 */
export function daysInMonth(ym: YearMonth): number {
  return new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
}

/** 日付（YYYY-MM-DD）の曜日。0=日 … 6=土 */
export function dowOfDate(date: string): number | null {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 月グリッドの1マス。null は先頭の空白 */
export type MonthCell = { date: string; day: number; dow: number } | null

/**
 * 月グリッドのマスを並べる。
 *
 * 先頭にだけ空白を入れ、月末の後ろには入れない（3画面ともこの作りだった）。
 * 末尾を7の倍数まで埋めないのは、最後の週だけ高さが変わるのを避けるためではなく、
 * 単に3画面ともそうしていたから。揃えるならここだけ直せばよい。
 */
export function buildMonthCells(ym: YearMonth): MonthCell[] {
  const lead = firstDowOf(ym)
  const total = daysInMonth(ym)
  const cells: MonthCell[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let day = 1; day <= total; day++) {
    cells.push({
      date: `${ym.y}-${pad2(ym.m + 1)}-${pad2(day)}`,
      day,
      dow: (lead + day - 1) % 7,
    })
  }
  return cells
}

/**
 * 日付の一覧から、出てくる月を古い順に並べる。
 *
 * 申込の画面は「日程のある月だけ」を行き先にしていて、
 * その月の一覧をここで作る（空の月へ送れてしまうと行き止まりになる）。
 */
export function monthsOfDates(dates: string[]): YearMonth[] {
  const keys = new Set<string>()
  for (const d of dates) {
    const ym = monthOfDate(d)
    if (ym) keys.add(monthKey(ym))
  }
  return [...keys].sort().map(k => {
    const [y, m] = k.split('-').map(Number)
    return { y, m: m - 1 }
  })
}

/**
 * 月の一覧（古い順）の中で、いまの月から next の向きへ進んだときに止まる月。
 *
 * MonthGrid は1か月ずつ送ってくる。申込の画面は日程のある月だけを行き先にするので、
 * 日程が飛び飛びの案件（10月と12月だけ、など）では、あいだの月を飛ばす。
 * 進む先に月が無ければ、端の月に留まる。
 */
export function stepToListedMonth(list: YearMonth[], current: YearMonth, next: YearMonth): YearMonth {
  if (list.length === 0) return current
  const dir = compareMonth(next, current)
  if (dir > 0) return list.find(m => compareMonth(m, next) >= 0) ?? list[list.length - 1]
  if (dir < 0) return [...list].reverse().find(m => compareMonth(m, next) <= 0) ?? list[0]
  return current
}

/**
 * 月の一覧に無い月を、一覧にある近い月へ寄せる（後ろ優先。無ければ最後の月）。
 * 一覧が空なら null。
 */
export function snapToListedMonth(list: YearMonth[], ym: YearMonth): YearMonth | null {
  if (list.length === 0) return null
  if (list.some(m => compareMonth(m, ym) === 0)) return ym
  return list.find(m => compareMonth(m, ym) > 0) ?? list[list.length - 1]
}

