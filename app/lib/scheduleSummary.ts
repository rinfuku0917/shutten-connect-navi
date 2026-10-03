// 案件詳細の「日程」の要約（開催期間・開催時間）。
//
// なぜ要るか（2026-10-03 の運営からの依頼）:
//   常設や長期の案件では、全日程が「2026-09-21 10:00〜19:30 /」の形で
//   縦に30行以上並び、スマホではエントリーの欄までのスクロールが長くなっていた。
//   詳細ページでは「期間」と「時間」の要約だけを出し、日ごとの一覧は開閉式にする。
//   日を選ぶのは、その下の申込のカレンダーで行える。
//
// ここは計算だけを持つ（描画は app/places/[id]/PlaceDetailClient.tsx）。

import { dowOfDate } from './monthGrid'

export type SummaryDay = { date: string; start?: string | null; end?: string | null }

const DOW = ['日', '月', '火', '水', '木', '金', '土']

/** 時刻として読める文字か（「選択してください」や空欄を外す） */
export const isTime = (t: string | null | undefined): t is string => !!t && /^\d{1,2}:\d{2}$/.test(t.trim())

/** 時刻を「10:05」の形の比較用の数に直す（「9:30」と「10:00」を正しく並べるため） */
const minutesOf = (t: string) => { const [h, m] = t.trim().split(':').map(Number); return h * 60 + m }

/**
 * 1日ぶんの時間帯の一覧。同じ日に2枠ある案件（昼と夜など）は2つ返す。
 * 時刻の読めない行（「選択してください」など）は外し、始まりの早い順に並べる
 */
export function slotsOfDay(rows: SummaryDay[], date: string): string[] {
  const list = rows
    .filter(d => d && d.date === date && isTime(d.start) && isTime(d.end))
    .map(d => ({ s: d.start!.trim(), e: d.end!.trim() }))
    .sort((a, b) => minutesOf(a.s) - minutesOf(b.s) || minutesOf(a.e) - minutesOf(b.e))
  // 同じ時間帯が2行入っていても1つにする
  return Array.from(new Set(list.map(x => `${x.s} 〜 ${x.e}`)))
}

/** 「2026年9月21日(月)」。withYear が false なら「10月21日(水)」 */
export function jpDate(date: string, withYear = true): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const w = dowOfDate(date)
  const dow = w == null ? '' : `(${DOW[w]})`
  return (withYear ? `${y}年` : '') + `${m}月${d}日${dow}`
}

/** 「9/21(月)」。開いたときの日ごとの一覧に使う */
export function shortDate(date: string): string {
  const [, m, d] = date.slice(0, 10).split('-').map(Number)
  const w = dowOfDate(date)
  return `${m}/${d}` + (w == null ? '' : `(${DOW[w]})`)
}

/** 2つの日付（YYYY-MM-DD）の間の日数。同じ日なら0 */
function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((toUtc(b) - toUtc(a)) / 86400000)
}

export type ScheduleSummary = {
  /** 日付の入っている日の数（同じ日の2枠は1日と数える） */
  count: number
  /** 「2026年9月21日(月) 〜 10月21日(水)」。1日だけなら「2026年9月21日(月)」 */
  period: string
  /** 期間の始まり「2026年9月21日(月)」と終わり「10月21日(水)」（1日だけなら to は空）。
   *  スマホで「(水)」だけが次の行に落ちないよう、画面ではこの2つを分けて折り返さない */
  from: string
  to: string
  /**
   * 期間の後ろに添える補足。「全30日」「火・木・金／全24日」など。
   * 期間だけだと「この間は毎日」と読まれるので、毎日でない案件には日数を必ず付ける
   */
  periodNote: string
  /**
   * いちばん多い1日ぶんの時間帯。「10:00 〜 19:30」。
   * 1日に2枠ある案件は2つ（「11:00 〜 14:00」「17:00 〜 21:00」）。時刻が無ければ空の配列
   */
  timeSlots: string[]
  /** timeSlots を「・」でつないだもの。時刻が無ければ空 */
  time: string
  /** 時間帯が日によって違うか（1日に2枠あるだけなら false） */
  timeVaries: boolean
}

/**
 * 日程の要約を作る。日付の入っていない行は数えない。日程が無ければ null。
 */
export function summarizeSchedule(rows: SummaryDay[] | null | undefined): ScheduleSummary | null {
  const days = (rows || []).filter(d => d && typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.date))
  if (days.length === 0) return null
  const dates = Array.from(new Set(days.map(d => d.date.slice(0, 10)))).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  const count = dates.length

  const sameYear = first.slice(0, 4) === last.slice(0, 4)
  const from = jpDate(first)
  const to = count === 1 ? '' : jpDate(last, !sameYear)
  const period = to ? `${from} 〜 ${to}` : from

  // 毎日か（期間の日数と、日程の日数が同じか）
  const everyDay = daysBetween(first, last) + 1 === count
  let periodNote = ''
  if (count > 1) {
    const dows = Array.from(new Set(dates.map(d => dowOfDate(d)).filter((w): w is number => w != null))).sort()
    // 毎日でなく、出る曜日が限られている案件は曜日も添える（「火・木・金／全24日」）。
    // 曜日が6つ以上あるときは並べても読みにくいだけなので、日数だけにする
    const dowText = !everyDay && dows.length > 0 && dows.length <= 5 ? dows.map(w => DOW[w]).join('・') + '／' : ''
    periodNote = everyDay ? `毎日・全${count}日` : `${dowText}全${count}日`
  }

  // 時間帯。日ごとに「その日の時間帯の組」を作り、いちばん多い組を出す。
  //
  // 行ごとに数えると、毎日「昼と夜」の2枠がある案件で、2つ目の枠が要約から消え、
  // 「日によって異なります」と事実と違う注記が付く（2026-10-03 の見直しで見つけた）。
  // 日ごとに組にして数えれば、2枠の日は2枠のまま出て、注記は本当に日で違うときだけ付く
  const patterns = new Map<string, { slots: string[]; n: number }>()
  for (const d of dates) {
    const slots = slotsOfDay(days, d)
    if (slots.length === 0) continue
    const k = slots.join('|')
    const cur = patterns.get(k)
    if (cur) cur.n += 1
    else patterns.set(k, { slots, n: 1 })
  }
  const ranked = [...patterns.values()].sort((a, b) => b.n - a.n || a.slots.join().localeCompare(b.slots.join()))
  const timeSlots = ranked.length > 0 ? ranked[0].slots : []
  const timeVaries = ranked.length > 1
  const time = timeSlots.join('・')

  return { count, period, from, to, periodNote, timeSlots, time, timeVaries }
}
