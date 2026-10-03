'use client'
import { useMemo, useState } from 'react'
import MonthGrid from './MonthGrid'
import {
  monthsOfDates, monthOfDate, compareMonth, todayJst, thisMonthJst, dowOfDate,
  type YearMonth,
} from '../lib/monthGrid'

// 案件の日程（places.schedule）を、月のカレンダーで入れる部品。
// 案件の作成・編集（app/dashboard/host/new-place・edit-place）で使う。運営も同じ画面を使う。
//
// なぜ要るか（2026-10-02・10-03 の運営からの依頼）:
//   日程の上限を90日に上げたところ、1日1枚のカード（日付・販売開始・販売終了・
//   取引先へ渡す額・弊社の固定額）が縦に並び、90日ぶんでは画面が極端に長くなった。
//   「日程や金額、手数料を設定する箇所をカレンダー式でコンパクトに収め、
//   日にちをタップすると設定できる項目が出る形に」という依頼。
//
// 操作:
//   ・日程に入っていない日を押す → その日を足して、設定を開く
//     （時間と金額は、直前に開いていた日、なければ最後の日から写す。複製と同じ働き）
//   ・日程に入っている日を押す → その日の設定を開く
//   ・設定の中の「この日を外す」で日程から外す
//   まとめて足すのは、これまでどおり「期間を指定して、まとめて追加」で行う（呼び出し側）。
//
// カレンダーの見た目は MonthGrid（申込画面と同じ）。ここが持つのは
// マスの中身（開始時刻・金額）と、押したときの操作、設定の欄だけ。

export type ScheduleRow = {
  date: string
  start: string
  end: string
  placeFee?: number
  companyFee?: number
}

const UNSET = '選択してください'
const DOW = ['日', '月', '火', '水', '木', '金', '土']

const isTime = (t: string | undefined) => !!t && t !== UNSET && /^\d{1,2}:\d{2}$/.test(t)

/** 日付の入っていない、何も入れていない行（新規作成の最初の1行） */
const isPlaceholder = (r: ScheduleRow) =>
  !r.date && (!r.start || r.start === UNSET) && (!r.end || r.end === UNSET)
  && r.placeFee == null && r.companyFee == null

/** 「10月6日（火）」 */
function dayTitle(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const w = dowOfDate(date)
  return `${m}月${d}日` + (w == null ? '' : `（${DOW[w]}）`)
}

export default function ScheduleCalendarEditor({
  rows,
  setRows,
  perDayOn,
  times,
  maxDays,
  inputStyle,
}: {
  rows: ScheduleRow[]
  setRows: React.Dispatch<React.SetStateAction<ScheduleRow[]>>
  /** 「日によって金額を変える」が入っているか。入っていれば金額の欄を出す */
  perDayOn: boolean
  /** 時刻の選択肢（先頭は「選択してください」） */
  times: string[]
  /** 日程に入れられる日数の上限（app/lib/scheduleLimits.ts） */
  maxDays: number
  inputStyle: React.CSSProperties
}) {
  const today = todayJst()
  // 日付ごとの行（同じ日に2枠ある案件があるので配列で持つ）。i は rows の中の位置
  const byDate = useMemo(() => {
    const m = new Map<string, { row: ScheduleRow; i: number }[]>()
    rows.forEach((row, i) => {
      if (!row.date) return
      const list = m.get(row.date) ?? []
      list.push({ row, i })
      m.set(row.date, list)
    })
    return m
  }, [rows])
  const dayCount = byDate.size
  // 上限は行の数（同じ日の2つ目の時間帯も1つと数える）で判定する。
  // まとめて追加・毎月の自動追加と同じ数え方にそろえるため。日数と違うときは画面にも出す
  const slotCount = rows.filter(r => !isPlaceholder(r)).length

  // 最初に出す月: 今日以降でいちばん早い日の月 → 無ければ最後の日の月 → 無ければ今月。
  // 利用者が月を送るまでは毎回ここから決める。「期間を指定して、まとめて追加」など、
  // この部品の外で日程が変わったときに、足された月へ移るため（新規作成では空の状態で描かれる）
  const startMonth = useMemo<YearMonth>(() => {
    const dates = [...byDate.keys()].sort()
    const next = dates.find(d => d >= today)
    const pick = next ?? dates[dates.length - 1]
    return (pick && monthOfDate(pick)) || thisMonthJst()
  }, [byDate, today])
  const [picked, setPicked] = useState<YearMonth | null>(null)
  const month = picked ?? startMonth

  const [focus, setFocus] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  // 設定を開いている日が日程から外れたら、設定の欄は閉じる
  const focusRows = focus ? byDate.get(focus) ?? [] : []

  // 新しく足す日に写す内容。開いている日 → 最後に入れた日 → 空
  const templateOf = (): Omit<ScheduleRow, 'date'> => {
    const src = (focus && byDate.get(focus)?.[0]?.row)
      ?? [...rows].reverse().find(r => r.date)
    if (!src) return { start: UNSET, end: UNSET }
    const t: Omit<ScheduleRow, 'date'> = { start: src.start || UNSET, end: src.end || UNSET }
    // 金額は「日によって金額を変える」が入っているときだけ写す。
    // 外れていると金額の欄もマスの金額も見えないので、見えない額が新しい日に入り、
    // 案件全体の金額ではなくその額で請求されてしまう
    if (perDayOn && src.placeFee != null) t.placeFee = src.placeFee
    if (perDayOn && src.companyFee != null) t.companyFee = src.companyFee
    return t
  }

  const addDate = (date: string) => {
    // 上限は、いま画面に出ている日程で判定する。
    // （setRows に渡す関数の中で決めた結果を外へ持ち出さない。React はあの関数を
    //   後でまとめて呼ぶことがあり、開発時は2回呼ぶので、外から読むと当てにならない）
    if (rows.filter(r => !isPlaceholder(r)).length >= maxDays) { setFull(true); return }
    const tpl = templateOf()
    setRows(prev => {
      // 新規作成の最初の空の1行は、日付を入れた時点で要らなくなる
      const kept = prev.filter(r => !isPlaceholder(r))
      if (kept.length >= maxDays || kept.some(r => r.date === date)) return prev
      // 日付の順に差し込む（保存される並びと、出店者の画面の並びをそろえる）
      const at = kept.findIndex(r => r.date && r.date > date)
      const row: ScheduleRow = { date, ...tpl }
      return at < 0 ? [...kept, row] : [...kept.slice(0, at), row, ...kept.slice(at)]
    })
    setFull(false)
    setFocus(date)
  }

  const onPickDate = (date: string) => {
    if (byDate.has(date)) { setFocus(date); setFull(false); return }
    addDate(date)
  }

  const removeDate = (date: string) => {
    // 表示中の月にとどめる。月を自分で送っていないあいだは「今日以降の最初の日」の月を
    // 出しているので、その月の最後の日を外すと、画面が勝手に次の月へ移ってしまう
    setPicked(month)
    setRows(prev => {
      const next = prev.filter(r => r.date !== date)
      // 全部外したら、最初の空の1行に戻す（新規作成の初期状態と同じ形）
      return next.length > 0 ? next : [{ date: '', start: UNSET, end: UNSET }]
    })
    setFocus(null)
  }

  const removeSlot = (i: number) => setRows(prev => prev.filter((_, j) => j !== i))

  const addSlot = (date: string) => setRows(prev => {
    if (prev.length >= maxDays) return prev
    const last = [...prev.keys()].filter(j => prev[j].date === date).pop()
    if (last == null) return prev
    const copy = { ...prev[last] }
    return [...prev.slice(0, last + 1), copy, ...prev.slice(last + 1)]
  })

  // 時刻の欄を書き換える（その時間帯の行だけ）
  const updateTime = (i: number, k: 'start' | 'end', v: string) =>
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  // 金額の欄を書き換える。金額は1日に1つで、同じ日の行（時間帯）すべてに同じ値を入れる。
  // 計算（app/lib/placeFee.ts の perDayFee）はその日の最初の行の金額しか読まないので、
  // 時間帯ごとに別の額を入れられる形にすると、2つ目に入れた額が黙って捨てられる。
  // 数字だけを読み、空欄は「未設定」として項目ごと消す
  // （空欄の日は案件全体の金額が使われる。0 と空欄は意味が違う）
  const updateFee = (date: string, k: 'placeFee' | 'companyFee', v: string) => {
    const digits = v.replace(/[^0-9]/g, '')
    setRows(prev => prev.map(r => {
      if (r.date !== date) return r
      const next = { ...r }
      if (digits === '') delete next[k]
      else next[k] = parseInt(digits, 10)
      return next
    }))
  }

  // 時間が決まっていない日の数（マスに赤字で出し、ここでも数を知らせる）
  const noTimeDays = [...byDate.entries()].filter(([, list]) => list.some(({ row }) => !isTime(row.start) || !isTime(row.end))).length
  // 日程のある月（見出しの下に、どの月に何日あるかを出す。別の月に入っている日を見落とさないため）
  const monthsWithDays = monthsOfDates([...byDate.keys()])

  const smallBtn: React.CSSProperties = {
    font: 'inherit', fontSize: '12px', fontWeight: 700, borderRadius: '8px',
    padding: '7px 12px', cursor: 'pointer', minHeight: '34px',
  }

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, marginBottom: '8px' }}>
        日付を押すと日程に追加されます。追加した日を押すと、時間{perDayOn ? '・金額' : ''}を変えられます。
        <br />
        <strong style={{ color: '#1a1a1a' }}>日程：{dayCount}日</strong>
        {slotCount !== dayCount && <span>（時間帯 {slotCount}枠）</span>}
        <span>（最大{maxDays}{slotCount !== dayCount ? '枠' : '日'}）</span>
        {monthsWithDays.length > 1 && (
          <span>　{monthsWithDays.map(ym => {
            const n = [...byDate.keys()].filter(d => { const x = monthOfDate(d); return x && compareMonth(x, ym) === 0 }).length
            return `${ym.m + 1}月 ${n}日`
          }).join('・')}</span>
        )}
      </div>

      <MonthGrid
        month={month}
        onMonthChange={setPicked}
        today={today}
        onPickDate={onPickDate}
        cellOf={date => {
          const list = byDate.get(date)
          if (!list) return { label: `${dayTitle(date)} 日程なし（押すと追加）` }
          const r = list[0].row
          const fee = (r.placeFee ?? 0) + (r.companyFee ?? 0)
          return {
            selected: true,
            focused: focus === date,
            label: `${dayTitle(date)} 日程あり ${isTime(r.start) && isTime(r.end) ? r.start + '〜' + r.end : '時間未選択'}`
              + (perDayOn && (r.placeFee != null || r.companyFee != null) ? ` ${fee.toLocaleString()}円` : '')
              + (list.length > 1 ? ` ほか${list.length - 1}枠` : ''),
          }
        }}
        renderCell={date => {
          const list = byDate.get(date)
          if (!list) return null
          const r = list[0].row
          const hasFee = perDayOn && (r.placeFee != null || r.companyFee != null)
          const fee = (r.placeFee ?? 0) + (r.companyFee ?? 0)
          return (
            <>
              {isTime(r.start)
                ? <span className='cal-amt' style={{ color: '#475569' }}>{r.start}</span>
                : <span className='cal-amt' style={{ color: '#DC2626' }}>時間?</span>}
              {hasFee && (
                <span className={'cal-amt' + (fee.toLocaleString().length >= 6 ? ' cal-amt-sm' : '')} style={{ color: '#B45309' }}>
                  {fee.toLocaleString()}
                </span>
              )}
              {list.length > 1 && <span className='cal-mark' style={{ color: '#1D4ED8' }}>{list.length}枠</span>}
            </>
          )
        }}
      />

      {full && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#DC2626', fontWeight: 700 }}>
          日程は{maxDays}{slotCount !== dayCount ? '枠までです（同じ日の2つ目の時間帯も1枠と数えます）' : '日までです'}。終わった日を外してから足してください。
        </div>
      )}
      {noTimeDays > 0 && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#DC2626' }}>
          販売時間が選ばれていない日が{noTimeDays}日あります（マスに赤字で「時間?」と出ている日）。
        </div>
      )}

      {/* 押した日の設定。日程に入っている日を押したときだけ出す */}
      {focus && focusRows.length > 0 && (
        <div className='sched-day' style={{ marginTop: '10px', border: '2px solid #1D4ED8', borderRadius: '10px', padding: '12px', background: '#FFFDF7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a' }}>{dayTitle(focus)} の設定</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type='button' onClick={() => removeDate(focus)}
                style={{ ...smallBtn, background: '#FEF2F2', color: '#DC2626', border: 'none' }}>
                この日を外す
              </button>
              <button type='button' onClick={() => setFocus(null)}
                style={{ ...smallBtn, background: '#fff', color: '#64748B', border: '1px solid #E5E7EB' }}>
                閉じる
              </button>
            </div>
          </div>

          {focusRows.map(({ row, i }, n) => (
            <div key={i} style={{ borderTop: n > 0 ? '1px dashed #E5C07B' : 'none', paddingTop: n > 0 ? '10px' : 0, marginTop: n > 0 ? '10px' : 0 }}>
              {focusRows.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#B45309' }}>{n + 1}つ目の時間帯</span>
                  <button type='button' onClick={() => removeSlot(i)}
                    style={{ ...smallBtn, minHeight: '28px', padding: '4px 10px', background: '#FEF2F2', color: '#DC2626', border: 'none' }}>
                    この時間帯を消す
                  </button>
                </div>
              )}
              <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>販売開始</label>
                  <select value={row.start} onChange={e => updateTime(i, 'start', e.target.value)} style={{ ...inputStyle, marginTop: '4px' }}>
                    {times.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>販売終了</label>
                  <select value={row.end} onChange={e => updateTime(i, 'end', e.target.value)} style={{ ...inputStyle, marginTop: '4px' }}>
                    {times.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {/* 日によって金額が変わる案件（平日2,000円・週末3,000円など）向け。
              入れた日はこの金額を使い、空欄の日は案件全体の設定を使う。
              金額は1日に1つ（時間帯では分けられない。上の updateFee の説明） */}
          {perDayOn && (
            <div style={{ borderTop: focusRows.length > 1 ? '1px dashed #E5C07B' : 'none', paddingTop: focusRows.length > 1 ? '10px' : 0, marginTop: '10px' }}>
              <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#B45309' }}>取引先へ渡す額（円）</label>
                  <input inputMode='numeric' value={focusRows[0].row.placeFee ?? ''} onChange={e => updateFee(focus, 'placeFee', e.target.value)} placeholder='例：2000' style={{ ...inputStyle, marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>弊社の固定額（円）</label>
                  <input inputMode='numeric' value={focusRows[0].row.companyFee ?? ''} onChange={e => updateFee(focus, 'companyFee', e.target.value)} placeholder='空欄可' style={{ ...inputStyle, marginTop: '4px' }} />
                </div>
              </div>
              {focusRows.length > 1 && (
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>金額は1日ごとです（時間帯では分けられません）。</div>
              )}
            </div>
          )}

          {/* 同じ日に2つ目の時間帯（昼と夜など）。実際に2枠の案件がある */}
          {rows.length < maxDays && (
            <button type='button' onClick={() => addSlot(focus)}
              style={{ ...smallBtn, marginTop: '10px', width: '100%', background: '#fff', color: '#B45309', border: '1.5px dashed #F5A623' }}>
              ＋ 同じ日に時間帯を足す
            </button>
          )}
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '8px', lineHeight: 1.7 }}>
            ほかの日付を押すと、この日と同じ時間{perDayOn ? '・金額' : ''}で追加されます。
          </div>
        </div>
      )}
    </div>
  )
}
