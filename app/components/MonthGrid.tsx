'use client'
import type { ReactNode } from 'react'
import {
  DOW_LABELS, DOW_COLORS, buildMonthCells, monthLabel, shiftMonth, compareMonth,
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
// 【印の色】
//   もともと画面ごとにばらばらだった（選択がオレンジの画面と青の画面があり、
//   今日の印も逆になっていた）。依頼が「全部同じに」なので、
//   申込の画面（手本）に合わせて 選択=オレンジ / 今日=青 で揃える。
//   変えたいときは accent と todayColor を渡す。

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
  dowColors = true,
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
  /** 日付の数字を曜日で色分けするか */
  dowColors?: boolean
  /** カレンダーの下に続けるもの（凡例など） */
  children?: ReactNode
}) {
  const cells = buildMonthCells(month)
  const canBack = !minMonth || compareMonth(month, minMonth) > 0
  const canNext = !maxMonth || compareMonth(month, maxMonth) < 0
  const minH = size === 'compact' ? 46 : 62

  const navBtn = (on: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: '13px', fontWeight: 700,
    border: '1px solid #E2E8F0', background: '#fff', color: on ? '#334155' : '#CBD5E1',
    borderRadius: '8px', padding: '7px 13px', minHeight: '38px',
    cursor: on ? 'pointer' : 'not-allowed',
  })

  return (
    <div>
      {/* 月の見出しと送り。3画面で同じ並びにそろえる */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button type='button' aria-label='前の月' disabled={!canBack}
          onClick={() => onMonthChange(shiftMonth(month, -1))} style={navBtn(canBack)}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 900, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
            {monthLabel(month)}
          </div>
          {showThisMonth && (
            <button type='button' onClick={() => {
              const d = new Date(Date.now() + 9 * 3600 * 1000)
              onMonthChange({ y: d.getUTCFullYear(), m: d.getUTCMonth() })
            }} style={{ ...navBtn(true), fontSize: '12px', fontWeight: 700, padding: '6px 11px', minHeight: '32px' }}>
              今月
            </button>
          )}
        </div>
        <button type='button' aria-label='次の月' disabled={!canNext}
          onClick={() => onMonthChange(shiftMonth(month, 1))} style={navBtn(canNext)}>›</button>
      </div>

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
              : '1px solid #E2E8F0'
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
                // 選択中はうすく色を敷く。枠線だけだと、スマホで押した日が分かりにくい
                background: st.selected && !off ? '#FFFBEB'
                  : off ? '#F8FAFC' : st.filled ? '#F8FDF9' : '#fff',
                backgroundImage: st.slashed
                  ? 'linear-gradient(to top right, transparent 47%, #E2E8F0 47%, #E2E8F0 53%, transparent 53%)'
                  : undefined,
                cursor: off || !onPickDate ? 'default' : 'pointer',
                opacity: off ? 0.55 : 1,
              }}
            >
              <span className='mg-num' style={{
                color: st.slashed ? '#CBD5E1'
                  : isToday ? todayColor
                    : dowColors ? DOW_COLORS[c.dow] : '#334155',
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
