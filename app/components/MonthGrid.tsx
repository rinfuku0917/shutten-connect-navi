'use client'
import { useRef, type ReactNode } from 'react'
import {
  DOW_LABELS, DOW_COLORS, buildMonthCells, monthLabel, shiftMonth, compareMonth, monthOfDate, thisMonthJst,
  type YearMonth,
} from '../lib/monthGrid'

// 月のカレンダーの見た目。日付の計算は app/lib/monthGrid.ts。
//
// なぜ要るか（2026-10-02 の運営からの依頼）:
//   カレンダーが3画面にあり、どれも別に書かれていた。
//     ・出店者が申し込む画面（app/components/ApplyDateCalendar.tsx）
//     ・出店者マイページの出店カレンダー（app/dashboard/seller/page.tsx に直書き）
//     ・運営の出店管理（app/admin/ScheduleCalendar.tsx）
//   「同じ見た目・同じ操作にしてほしい」という依頼を受けたので、
//   月の見出し・月送り・曜日の行・マスの枠をここに1本化する。
//
// 【どこまでをここが持つか】
//   持つ   … 月の見出し、前後の月ボタン、「今月」、曜日の行、マスの並びと枠、
//            選択・今日・押せないの印、スマホの寸法、キーボード操作
//   持たない … マスの中身、押したときに何をするか、データの取得
//
//   マスの中身は renderCell で呼び出し側が描く。
//   3画面で中身がまったく違うため（金額／屋号と件数／状態と売上）、
//   ここで出し分けると分岐だらけになり、結局3つ書くのと同じになる。
//
// 【見た目の手本は、出店者が申し込む画面のカレンダー】
//   依頼（2026-10-02）は「予約画面のカレンダーと全く同じ仕様に」というもの。
//   最初に共通化したとき、運営・マイページ側の見た目（‹ › の小さな送りボタン、
//   曜日色の日付、上寄せの数字）を基準にしてしまい、運営とマイページは見た目が
//   ほとんど変わらず、逆に手本の申込画面のほうが変わってしまった
//   （2026-10-03 に運営から「変化なし」と指摘）。
//   申込画面の元の作り（◀ 前の月／次の月 ▶、黒い日付をマスの中央、
//   押せない日は薄い灰色）に合わせ直した。
//
// 【印の色】
//   選択=オレンジ / 今日=青。変えたいときは accent と todayColor を渡す。
//   focused（いま設定を開いている日）は青の太枠。料金設定のカレンダーで、
//   「日程に入っている日（オレンジ）」と「いま編集している日」を見分けるのに使う。

export type MonthGridCell = {
  /** 選択中の印を出すか */
  selected?: boolean
  /** 押せない（薄く出して押させない） */
  disabled?: boolean
  /** 中身がある日。背景をわずかに敷く */
  filled?: boolean
  /**
   * 斜線を引く（「この日はそもそも対象外」を押せないのと区別して示す）。
   * 申込の画面で、案件の日程に入っていない日に使う。
   * disabled だけだと「選べない日」と見分けが付かず、凡例
   * 「斜線の日は募集対象外／× は選べない日」が成り立たなくなる
   */
  slashed?: boolean
  /** 読み上げと長押しに出す説明 */
  label?: string
  /** いま設定を開いている日（青の太枠）。料金設定のカレンダーで使う */
  focused?: boolean
}

const ACCENT = '#F5A623'
const TODAY = '#3A9BD5'

export default function MonthGrid({
  month,
  onMonthChange,
  minMonth,
  maxMonth,
  today,
  cellOf,
  renderCell,
  onPickDate,
  size = 'normal',
  accent = ACCENT,
  todayColor = TODAY,
  showThisMonth = true,
  note,
  dowColors = false,
  children,
}: {
  month: YearMonth
  onMonthChange: (ym: YearMonth) => void
  /** これより前へは送れない（申込の画面で、日程のある月に閉じるのに使う） */
  minMonth?: YearMonth
  maxMonth?: YearMonth
  /** 今日（YYYY-MM-DD）。渡すとその日に印が付く */
  today?: string
  /** その日のマスの状態。日付ごとに呼ぶ */
  cellOf?: (date: string) => MonthGridCell
  /** マスの中身。日付の数字はここでは描かない（上に出すのはこの部品） */
  renderCell?: (date: string) => ReactNode
  onPickDate?: (date: string) => void
  /** compact は申込の画面（幅300pxの右カラム）用 */
  size?: 'compact' | 'normal'
  accent?: string
  todayColor?: string
  showThisMonth?: boolean
  /** 月の見出しの下に出す1行（「この月の出店 23件」など） */
  note?: ReactNode
  /**
   * 日付の数字を曜日で色分けするか。既定は色分けしない（黒）。
   * 手本の申込画面は数字が黒で、曜日の色は上の曜日の行だけに付けている
   */
  dowColors?: boolean
  /** カレンダーの下に続けるもの（凡例など） */
  children?: ReactNode
}) {
  const cells = buildMonthCells(month)
  const canBack = !minMonth || compareMonth(month, minMonth) > 0
  const canNext = !maxMonth || compareMonth(month, maxMonth) < 0
  const minH = size === 'compact' ? 46 : 62

  // 送りボタンは申込画面の元の作りと同じ（◀ 前の月／次の月 ▶）。
  // font: 'inherit' は fontSize / fontWeight より前に置く（一括指定で上書きされるため）
  const navBtn = (on: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: '12.5px', fontWeight: 700, lineHeight: 1.4,
    border: '1px solid #E5E7EB', background: on ? '#fff' : '#F8FAFC', color: on ? '#1a1a1a' : '#CBD5E1',
    borderRadius: '8px', padding: '7px 11px', minHeight: '36px', whiteSpace: 'nowrap',
    cursor: on ? 'pointer' : 'default',
  })
  // 今月は today（呼び出し側が渡す日本の今日）から読む。
  // 描画の中で時計を読まない（描くたびに結果が変わり得るため）。
  // today を渡さない画面では、「今月に戻る」を押したときに時計を読む
  const todayMonth = today ? monthOfDate(today) : null
  // 「今月に戻る」は今月を見ているときは描かないので、押すとボタンごと消える。
  // キーボードで操作している人のフォーカスが行き場を失わないよう、月の見出しへ移す
  const headingRef = useRef<HTMLDivElement>(null)
  const awayFromThisMonth = todayMonth ? compareMonth(month, todayMonth) !== 0 : true

  return (
    <div>
      {/* 月の見出しと送り。4画面とも同じ並び（申込画面が手本） */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <button type='button' aria-label='前の月' disabled={!canBack}
          onClick={() => onMonthChange(shiftMonth(month, -1))} style={navBtn(canBack)}>◀ 前の月</button>
        <div ref={headingRef} tabIndex={-1} aria-live='polite'
          style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a', whiteSpace: 'nowrap', outline: 'none' }}>
          {monthLabel(month)}
        </div>
        <button type='button' aria-label='次の月' disabled={!canNext}
          onClick={() => onMonthChange(shiftMonth(month, 1))} style={navBtn(canNext)}>次の月 ▶</button>
      </div>

      {/* 「今月に戻る」。手本の申込画面には無いので、送りの並びには入れない。
          今月以外を見ているときだけ、見出しの下に小さく出す */}
      {showThisMonth && awayFromThisMonth && (
        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          <button type='button' onClick={() => { onMonthChange(todayMonth ?? thisMonthJst()); headingRef.current?.focus() }}
            style={{ font: 'inherit', fontSize: '12px', fontWeight: 700, color: '#1D4ED8', background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', textDecoration: 'underline' }}>
            今月に戻る
          </button>
        </div>
      )}

      {note && (
        <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', marginTop: '6px', lineHeight: 1.8 }}>
          {note}
        </div>
      )}

      {/* 曜日の行。読み上げでは飛ばさない（日付の意味が分からなくなるため） */}
      <div className='mg-grid' style={{ marginTop: '8px' }}>
        {DOW_LABELS.map((d, i) => (
          <div key={d} className='mg-dow' style={{ color: DOW_COLORS[i] }}>{d}</div>
        ))}
      </div>

      <div className='mg-grid' role='group' aria-label={monthLabel(month) + 'のカレンダー'} style={{ marginTop: '3px' }}>
        {cells.map((c, i) => {
          if (!c) return <div key={'blank-' + i} aria-hidden='true' style={{ minHeight: minH + 'px' }} />
          const st = cellOf ? cellOf(c.date) : {}
          const isToday = !!today && c.date === today
          const off = !!st.disabled
          const border = st.selected ? `2px solid ${accent}`
            : isToday ? `1.5px solid ${todayColor}`
              : '1px solid #E5E7EB'
          return (
            <button
              key={c.date}
              type='button'
              disabled={off || !onPickDate}
              aria-pressed={typeof st.selected === 'boolean' ? st.selected : undefined}
              aria-label={st.label || `${month.m + 1}月${c.day}日`}
              title={st.label}
              onClick={() => onPickDate?.(c.date)}
              className={'mg-cell' + (size === 'compact' ? ' mg-cell-compact' : '')}
              style={{
                minHeight: minH + 'px',
                border,
                // 選択中はうすく色を敷く。枠線だけだと、スマホで押した日が分かりにくい。
                // 押せない日・斜線の日は申込画面の元の色（薄い灰色の地）
                // background（一括指定）と backgroundImage を混ぜない。混ぜると、マスの状態が
                // 変わって描き直すときに一括指定が斜線を消してしまうことがある（React の警告）
                backgroundColor: st.selected && !off ? '#FFFBEB'
                  : st.slashed ? '#F8FAFC' : off ? '#FAFAFA' : st.filled ? '#F8FDF9' : '#fff',
                backgroundImage: st.slashed
                  ? 'linear-gradient(to top right, transparent 47%, #E2E8F0 47%, #E2E8F0 53%, transparent 53%)'
                  : undefined,
                boxShadow: st.focused ? '0 0 0 2px #1D4ED8' : undefined,
                color: off ? '#AAA' : '#1a1a1a',
                cursor: off || !onPickDate ? 'default' : 'pointer',
              }}
            >
              <span className='mg-num' style={{
                color: st.slashed ? '#CBD5E1'
                  : off ? '#AAA'
                    : isToday ? todayColor
                      : dowColors ? DOW_COLORS[c.dow] : '#1a1a1a',
                fontWeight: st.slashed ? 400 : isToday ? 900 : 700,
              }}>{c.day}</span>
              {renderCell?.(c.date)}
            </button>
          )
        })}
      </div>
      {children}
    </div>
  )
}
