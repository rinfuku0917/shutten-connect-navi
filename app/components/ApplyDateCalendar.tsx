'use client'
import { useMemo, useState } from 'react'
import { applyDaysShortfall } from '../lib/applyRules'

// 申込のときに出店希望日を選ぶカレンダー。
//
// なぜ作ったか:
//   以前は日程を1日1枚のカードで縦に並べていた。日程の多い案件
//   （最長31日ある）では申込枠が極端に縦長になり、
//   出店者がスクロールの途中で選ぶのをやめてしまっていた（2026-09-23 の依頼）。
//
// 運営の出店管理（app/admin/ScheduleCalendar.tsx）と出店者マイページにも
// 月のカレンダーがあるが、あちらは「決まった出店を見る」もので、扱うデータも
// 用途も違うため作りは分けている（共通化すると動いている画面を触ることになる）。
// 月の組み立て方・曜日の色・選択の枠線は、その2つと同じにそろえている。
//
// この部品は「どの日が選べて、その日はいくらか」を受け取って並べるだけ。
// 料金の決まり（形態ごと → 日程のその日 → 平日/土日祝 → 案件全体、最低保証）は
// app/lib/placeFee.ts が唯一の正で、呼ぶ側（案件詳細）が計算して渡す。
// ここで金額を組み立てないのは、画面ごとに言い方や優先順位がずれるのを防ぐため。

export type CalendarDay = {
  /** YYYY-MM-DD */
  date: string
  /** その日の時間帯。同じ日に2枠ある案件があるので配列で受ける */
  times: string[]
  /** 1日あたりの出店料（円）。歩合だけの案件など、確定しない日は null */
  amount: number | null
  /** 金額の代わりにマスへ出す短い語（「歩合」「期間」「相談」） */
  amountNote: string
  /** 額のうしろに付ける印（'＋' は歩合も加わる日、'最' は最低保証で決まる日） */
  amountMark: string
  /** 金額の全文（選んだ日の一覧に出す。「4,500円/日 ＋ 売上の20%（最低2,000円）」） */
  amountText: string
  /** 選べない日か */
  disabled: boolean
  /** 選べない理由。マスの説明（title）と凡例に使う */
  disabledReason: string
  /** すでに申し込んでいる日 */
  applied: boolean
}

// 曜日の色は運営の出店管理・出店者マイページのカレンダーと同じ（日=赤、土=青）
const DOW = ['日', '月', '火', '水', '木', '金', '土']
const DOW_COLOR = ['#DC2626', '#64748B', '#64748B', '#64748B', '#64748B', '#64748B', '#1D4ED8']

// このサイトの色。オレンジは選択、茶色は金額（案件詳細と同じ使い分け）
const ORANGE = '#F5A623'
const INK = '#1a1a1a'
const BROWN = '#B45309'

/** 'YYYY-MM-DD' → その月の 'YYYY-MM' */
const monthOf = (date: string) => date.slice(0, 7)

/** 'YYYY-MM' → 「2026年9月」 */
const monthLabel = (m: string) => `${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月`

/** その月の日数。new Date の月末繰り上がりを使う（月は0起点） */
const daysInMonth = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()

/** その月の1日が何曜日か（0=日） */
const firstDow = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).getDay()

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function ApplyDateCalendar({
  days,
  selected,
  onToggle,
  onSelectMany,
  onClearMonth,
  feeState,
  periodFee = 0,
  minDays = 1,
  dayCounts = [],
  countFee,
}: {
  days: CalendarDay[]
  selected: string[]
  onToggle: (date: string) => void
  /** 当月全選択。選べる日だけを渡す */
  onSelectMany: (dates: string[]) => void
  /** 当月の選択を解除 */
  onClearMonth: (dates: string[]) => void
  /**
   * 「期間で1回のみ」の出店料（app/lib/placeFee.ts の perEventFeeOf）。
   * 日数によらず1回だけ合計に足す。
   *
   * なぜ要るか（2026-09-25 の運営からの指摘）:
   *   3日間で8万円のイベントで3日選んでも、合計が0円のまま
   *   「期間で1回の出店料のため、合計には入れていません」と出るだけだった。
   *   申し込む人は自分が幾ら払うのか分からない。
   */
  periodFee?: number | null
  /**
   * 1回の申込で選ばないといけない最低の日数（app/lib/applyRules.ts の minApplyDays）。
   * 1なら1日から。1日だけの出店を受け付けない案件のために使う。
   */
  minDays?: number
  /**
   * 日数ごとの出店料（app/lib/placeFee.ts の dayCountFeeOf）。
   * 入っていれば、選んだ日数の額をここから引く。日ごとの額も期間ぶんも足さない。
   * 空の配列なら、これまでどおりの計算（2026-09-26 の運営からの相談）
   */
  dayCounts?: number[]
  countFee?: (days: number) => number | null
  /** 金額を出せるか。
   *   'ok'     … 出す
   *   'login'  … 未ログイン（案件詳細のほかの金額と同じく鍵を出す）
   *   'format' … ログイン済みだが出店形式を選んでいない。
   *              形式ごとに額が違う案件（催事PR 18,000円/日 と キッチンカー 3,000円/日 など）で
   *              未選択のまま額を出すと、案件全体の設定に落ちた別の額を見せてしまう。
   *              1日ぶんなら旧画面も同じだったが、カレンダーは「当月を全選択」で
   *              31日ぶんの合計にするため、桁違いの総額（8.4万 対 48.8万）になる */
  feeState: 'ok' | 'login' | 'format'
}) {
  const canSeeFee = feeState === 'ok'
  // 日程のある月だけを行き先にする。
  // 前後に無限に進めると、空の月を何度も送ることになるため
  // （案件の日程は1〜2か月に収まるが、年をまたぐものもある）
  const months = useMemo(
    () => Array.from(new Set(days.map(d => monthOf(d.date)))).sort(),
    [days],
  )
  // 最初に出す月は「選べる日がいちばん早い月」。
  // 選べる日が1日も無い案件（日程が全部過ぎている、申込の上限より先しか無い）は、
  // いちばん新しい月を出す。先頭の月にすると、何年も前の月が開いたままになる
  const startIndex = useMemo(() => {
    // 日付順に見る。days の並びは募集者が日程を入れた順なので、
    // 配列の先頭から探すと「いちばん早い日」とは限らない
    const first = days.filter(d => !d.disabled && !d.applied)
      .reduce<string | null>((a, d) => (a == null || d.date < a ? d.date : a), null)
    const i = first ? months.indexOf(monthOf(first)) : -1
    return i >= 0 ? i : Math.max(0, months.length - 1)
  }, [days, months])
  // 出す月。利用者が月を送るまでは startIndex に従う（null のあいだ）。
  // useState(startIndex) にすると、あとから days が変わっても初期値は変わらないため、
  // 申込済みの読み込み（myEntries）や形式の選び直しで選べる日がずれたときに、
  // 選べる日が1つも無い月を出したままになる
  const [index, setIndex] = useState<number | null>(null)
  const idx = Math.max(0, Math.min(index ?? startIndex, months.length - 1))
  const month = months[idx] ?? ''

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const d of days) {
      const prev = m.get(d.date)
      // 同じ日に2枠ある案件は、時間帯だけをまとめて1マスにする。
      // 2マスに分けると、日付とマスが1対1でなくなりカレンダーが崩れる
      if (prev) { m.set(d.date, { ...prev, times: [...prev.times, ...d.times] }); continue }
      m.set(d.date, d)
    }
    return m
  }, [days])

  if (!month) return null

  const total = daysInMonth(month)
  const lead = firstDow(month)
  const cells: (CalendarDay | string | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let n = 1; n <= total; n++) {
    const date = `${month}-${pad2(n)}`
    cells.push(byDate.get(date) ?? date)
  }

  const monthDays = [...byDate.values()].filter(d => monthOf(d.date) === month)
  const selectableDates = monthDays.filter(d => !d.disabled && !d.applied).map(d => d.date)
  // 「当月の選択を解除」は、選べなくなった日も数に入れる。
  // 選べる日だけで数えると、選んだあとに選べなくなった日（日付が変わって過去日になった、
  // 申込済みの読み込みが後から届いた）を外す手段が画面から無くなり、
  // 送信も検証で止まるため、再読み込みするまで申し込めない行き止まりになる
  const pickedHere = monthDays.filter(d => selected.includes(d.date)).length
  const allPicked = selectableDates.length > 0 && selectableDates.every(d => selected.includes(d))

  // 最低出店日数（1日だけの申込を受け付けない案件のため）。
  // 日は1日ずつ選べる。「3日のうち2日」を受け付ける案件があるので、
  // 全日まとめてに固定しない（2026-09-26 の運営からの説明）
  const everyDate = [...byDate.values()].filter(d => !d.disabled && !d.applied).map(d => d.date)
  const everyPicked = everyDate.length > 0 && everyDate.every(d => selected.includes(d))
  // 日程全部をまとめて選ぶ／外す（下限のある案件は、これが一番早い）
  const toggleAll = () => {
    if (everyPicked) onClearMonth([...byDate.values()].map(d => d.date))
    else onSelectMany(everyDate)
  }

  const chosen = selected.map(d => byDate.get(d)).filter((d): d is CalendarDay => !!d)
  // 選んだあとに選べなくなった日（日付が過ぎた・申込済み）。札から外せるように印を付ける。
  // 日数にも合計にも入れない。この日は送られない（submitEntry が止める）ので、
  // 入れると払う額を多く見せてしまう
  const stuck = chosen.filter(d => d.disabled || d.applied)
  const usable = chosen.filter(d => !d.disabled && !d.applied)
  // 日数の決まり（日数ごとの金額があればその日数、無ければ最低日数）に合っているか
  const daysRule = { min_apply_days: minDays, day_count_fees: dayCounts.length > 0 ? Object.fromEntries(dayCounts.map(n => [String(n), {}])) : null }
  const shortfall = applyDaysShortfall(daysRule, usable.length, everyDate.length)
  // 日数ごとの金額がある案件の、いま選んでいる日数の額
  const byCount = dayCounts.length > 0 && countFee ? countFee(usable.length) : null
  // 「期間で1回のみ」の額は、1日でも選んだら1回だけ足す。日数を掛けない
  const period = usable.length > 0 && (periodFee ?? 0) > 0 ? (periodFee as number) : 0
  // 選んだ日の合計。歩合だけの日は額が決まらないので、件数を添えて別に伝える。
  // 日数ごとの金額がある案件は、それが唯一の額（日ごとも期間ぶんも足さない）
  const sum = byCount != null
    ? byCount
    : usable.reduce((a, d) => a + (d.amount ?? 0), 0) + period
  // 額が決まらない日は理由が3通りある（歩合・期間で1回・要相談）。
  // まとめて「売上に応じて決まる」と書くと、期間で1回の案件や
  // 金額が未設定の案件に事実と違う説明が出る。
  // 「期間」の日は、期間ぶんの額を合計に入れられたなら理由を出さない
  // （「合計に入れていません」と書きながら合計に入っていることになる）
  const openByNote = ['歩合', '期間', '日数', '相談'].map(n => ({
    note: n,
    // 合計を出せているときは理由を出さない
    // （「合計に入れていません」と書きながら合計に入っていることになる）
    count: (n === '期間' && period > 0) || (n === '日数' && byCount != null) ? 0
      : usable.filter(d => d.amount == null && d.amountNote === n).length,
  })).filter(x => x.count > 0)
  const OPEN_TEXT: Record<string, string> = {
    '歩合': '売上に応じて決まるため',
    '期間': '期間で1回の出店料のため',
    '日数': '出店料が選んだ日数で決まるため',
    '相談': '出店料が「要相談」のため',
  }
  // 2日以上選んでいて、時間帯が日によって違うとき。
  // 1日しか選んでいない（けれどその日に2枠ある）ときに「日によって異なります」と出すのは嘘になる
  const mixedTimes = usable.length > 1 && new Set(usable.flatMap(d => d.times)).size > 1
  // 最低保証で決まる日・歩合が乗る日が混ざっていたら、合計は「下限」であって確定額ではない。
  // 以前のカード一覧は1日ごとに「最低2,000円（売上の20%）」と文字で出していたので、
  // ここで言い方を変えると、売上次第で増えることが伝わらなくなる
  const upCount = usable.filter(d => d.amount != null && (d.amountMark === '最' || d.amountMark === '＋')).length

  // 日程はあるのに、選べる日が1日も無い案件（全部過ぎた、全部申込の上限より先、
  // 全部申込済み、選んだ形式では出られない曜日だけ）。理由をまとめて出す
  const noneSelectable = days.length > 0 && !days.some(d => !d.disabled && !d.applied)
  const reasons = noneSelectable
    ? Array.from(new Set(days.map(d => d.applied ? 'すべて申込済み' : d.disabledReason).filter(Boolean)))
    : []

  // font: 'inherit' は必ず fontSize / fontWeight より前に置く。
  // CSS の font は一括指定なので、あとに書くと文字の大きさと太さを上書きしてしまう
  // （ボタンは既定でブラウザの書体になるため、書体だけは継承させたい）
  const navBtn = (on: boolean) => ({
    font: 'inherit', fontSize: '12px', fontWeight: 700, lineHeight: 1.4,
    border: '1px solid #E5E7EB', background: on ? '#fff' : '#F8FAFC', color: on ? INK : '#CBD5E1',
    borderRadius: '8px', padding: '6px 10px',
    cursor: on ? 'pointer' : 'default',
  })
  const subBtn = {
    font: 'inherit', fontSize: '12px', fontWeight: 700,
    border: '1px solid #E5C07B', background: '#FFFBEB', color: BROWN, borderRadius: '8px',
    padding: '7px 10px', cursor: 'pointer', flex: 1,
  }

  return (
    <div style={{ marginBottom: '14px' }}>
      {/* 月送り。日程のある月だけを行き来する */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
        <button
          type='button'
          onClick={() => setIndex(Math.max(0, idx - 1))}
          disabled={idx <= 0}
          aria-label='前の月'
          style={navBtn(idx > 0)}
        >
          ◀ 前の月
        </button>
        <div style={{ fontSize: '13.5px', fontWeight: 900, color: INK }}>{monthLabel(month)}</div>
        <button
          type='button'
          onClick={() => setIndex(Math.min(months.length - 1, idx + 1))}
          disabled={idx >= months.length - 1}
          aria-label='次の月'
          style={navBtn(idx < months.length - 1)}
        >
          次の月 ▶
        </button>
      </div>

      {/* 日数に下限がある案件は、カレンダーを触る前に伝える。
          あとから「1日では申し込めません」と出すより、先に言うほうが迷わない */}
      {(dayCounts.length > 0 || minDays > 1) && (
        <div style={{ fontSize: '12px', color: BROWN, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 10px', margin: '0 0 8px', lineHeight: 1.8 }}>
          {dayCounts.length > 0 ? (
            <>この案件は<strong>{dayCounts.filter(n => n <= Math.max(everyDate.length, 1)).join('日または')}日</strong>でのお申し込みです。
            選んだ日数で出店料が変わります。日は1日ずつ選べます。</>
          ) : (
            <>この案件は<strong>{Math.min(minDays, Math.max(everyDate.length, 1))}日以上</strong>でのお申し込みです。
            1日だけの出店はできません。日は1日ずつ選べます。</>
          )}
        </div>
      )}

      {/* 曜日の行。読み上げから隠さない。
          この画面は「選んだ形式で出店できない曜日がある」ことが選択可否を決めるので、
          曜日が読まれないと、なぜ選べないのかが音声だけでは分からなくなる */}
      <div className='cal-grid'>
        {DOW.map((d, i) => <div key={d} className='cal-dow' style={{ color: DOW_COLOR[i] }}>{d}</div>)}
      </div>

      <div className='cal-grid' role='group' aria-label={`${monthLabel(month)}の出店希望日`}>
        {cells.map((c, i) => {
          if (c === null) return <div key={'b' + i} />
          // 日程に入っていない日＝募集対象外。斜線を引いて、押せないことを示す
          if (typeof c === 'string') {
            return (
              <div
                key={c}
                className='cal-cell'
                style={{
                  color: '#CBD5E1', background: '#F8FAFC',
                  backgroundImage: 'linear-gradient(to top right, transparent 47%, #E2E8F0 47%, #E2E8F0 53%, transparent 53%)',
                }}
                title='この日は募集していません'
              >
                <span className='cal-num' style={{ fontWeight: 400 }}>{Number(c.slice(8))}</span>
              </div>
            )
          }
          const day = Number(c.date.slice(8))
          const on = selected.includes(c.date)
          const off = c.disabled || c.applied
          const times = c.times.filter(Boolean).join('・')
          // 読み上げと吹き出しに出す説明。曜日も入れる
          // （形式によって出店できない曜日があるので、曜日が分からないと理由が伝わらない）
          const dow = DOW[new Date(Number(c.date.slice(0, 4)), Number(c.date.slice(5, 7)) - 1, day).getDay()]
          // マスに出す額。マスは幅34〜45pxしかないので、長いときは
          //   1) まず印（最・＋）を落とす（意味は下の札と凡例に出る）
          //   2) それでも長ければ文字を一段小さくする（.cal-amt-sm）
          // 何もしないと overflow:hidden で額の左右が切れて読めなくなる
          const yen = c.amount != null ? c.amount.toLocaleString() : c.amountNote
          const withMark = c.amount != null ? yen + c.amountMark : yen
          const amt = withMark.length >= 7 ? yen : withMark
          const title = [
            `${c.date.replaceAll('-', '/')}（${dow}）${times ? '（' + times + '）' : ''}`,
            canSeeFee ? c.amountText : '出店料はログイン後に表示',
            c.applied ? '申込済み' : c.disabledReason,
          ].filter(Boolean).join(' / ')
          return (
            <button
              key={c.date}
              type='button'
              disabled={off}
              onClick={() => onToggle(c.date)}
              aria-pressed={on}
              aria-label={title}
              title={title}
              className='cal-cell'
              style={{
                border: on ? `2px solid ${ORANGE}` : '1px solid #E5E7EB',
                background: off ? '#FAFAFA' : (on ? '#FFFBEB' : '#fff'),
                color: off ? '#AAA' : '#1a1a1a',
                cursor: off ? 'default' : 'pointer',
              }}
            >
              <span className='cal-num'>{day}</span>
              {/* 金額はログイン後だけ。未ログインには鍵を出す（一覧・詳細と同じ扱い） */}
              {c.applied
                ? <span className='cal-mark' style={{ color: '#16A34A', fontWeight: 700 }}>済</span>
                : c.disabled
                  ? <span className='cal-mark'>×</span>
                  : canSeeFee
                    ? <span className={'cal-amt' + (amt.length >= 7 ? ' cal-amt-sm' : '')} style={{ color: BROWN }}>{amt}</span>
                    : feeState === 'login'
                      ? <span className='cal-mark' style={{ color: '#CBD5E1' }}>🔒</span>
                      : null}
            </button>
          )
        })}
      </div>

      {/* 選べる日が1日も無いとき、なぜ選べないのかを書く。
          × と斜線だけのカレンダーが出ていると、画面の不具合に見える */}
      {noneSelectable && (
        <div style={{ marginTop: '8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#DC2626', lineHeight: 1.7 }}>
          いまお申し込みできる日がありません{reasons.length > 0 ? `（${reasons.join('、')}）` : ''}。
          <br />募集者に日程が追加されることがあるので、しばらくしてからご覧ください。
        </div>
      )}

      {/* 日数に下限がある案件は、日程が月をまたぐこともあるので
          「日程ぜんぶ」の1押しも用意する（当月ぶんだけでは下限に届かないことがある） */}
      {(dayCounts.length > 0 || minDays > 1) && months.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button
            type='button'
            onClick={toggleAll}
            disabled={everyDate.length === 0}
            style={{ ...subBtn, width: '100%', opacity: everyDate.length === 0 ? 0.45 : 1 }}
          >
            {everyPicked ? '選択をすべて解除' : `日程の${everyDate.length}日すべてを選ぶ`}
          </button>
        </div>
      )}
      {
        /* 当月まとめて選ぶ・外す。日程が20日を超える案件があるため */
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button
            type='button'
            onClick={() => onSelectMany(selectableDates)}
            disabled={selectableDates.length === 0 || allPicked}
            style={{ ...subBtn, opacity: selectableDates.length === 0 || allPicked ? 0.45 : 1 }}
          >
            当月を全選択
          </button>
          <button
            type='button'
            onClick={() => onClearMonth(monthDays.map(d => d.date))}
            disabled={pickedHere === 0}
            style={{ ...subBtn, border: '1px solid #E5E7EB', background: '#fff', color: '#64748B', opacity: pickedHere === 0 ? 0.45 : 1 }}
          >
            当月の選択を解除
          </button>
        </div>
      }

      {/* 選んだ日と合計。カレンダーのマスには時間帯を出せないので、ここで出す */}
      <div style={{ marginTop: '10px', border: '1px solid #FFE0A0', background: '#FFF9E6', borderRadius: '8px', padding: '10px 12px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 900, color: INK, marginBottom: chosen.length ? '6px' : 0 }}>
          選択した日：{usable.length}日
          {canSeeFee && usable.length > 0 && sum > 0 && (
            <span style={{ color: BROWN }}>　{upCount > 0 ? '合計（最低）' : '合計'} {sum.toLocaleString()}円</span>
          )}
        </div>
        {feeState === 'format' && (
          <div style={{ fontSize: '11.5px', color: BROWN, marginBottom: '6px' }}>
            上で出店形式を選ぶと、1日ごとの出店料と合計が出ます
          </div>
        )}
        {/* 日数が下限に足りていない。送信で止まる前に、合計のそばで知らせる */}
        {shortfall && (
          <div style={{ fontSize: '11.5px', color: '#DC2626', fontWeight: 700, marginBottom: '6px' }}>
            {shortfall.message}
          </div>
        )}
        {/* 期間ぶんの額は日数を掛けないので、そのことを合計のそばで言う。
            言わないと「3日選んだのに1日分しか足されていない」と読まれる */}
        {canSeeFee && period > 0 && byCount == null && (
          <div style={{ fontSize: '11.5px', color: BROWN, marginBottom: '6px' }}>
            うち {period.toLocaleString()}円 は期間ぶんの出店料です（何日選んでも1回だけ）
          </div>
        )}
        {chosen.length === 0
          ? <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>出店したい日をカレンダーから選んでください（複数選択できます）</div>
          : (
            <>
              {/* 1日1行にすると31日選んだときに31行になり、
                  カードを縦に並べていた元の作りと同じ長さに戻ってしまう。
                  日付と額だけの札にして折り返す */}
              {/* 札は押すと外せる。選べなくなった日（過ぎた日・申込済み）はマスから外せないので、
                  外す手段をここに必ず残しておく */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
                {chosen.slice().sort((a, b) => a.date.localeCompare(b.date)).map(d => {
                  const bad = d.disabled || d.applied
                  return (
                    <button
                      key={d.date}
                      type='button'
                      onClick={() => onToggle(d.date)}
                      title={`${canSeeFee ? d.amountText + ' / ' : ''}押すと選択から外します`}
                      style={{ font: 'inherit', fontSize: '11px', color: bad ? '#DC2626' : '#475569', background: '#fff', border: '1px solid ' + (bad ? '#FECACA' : '#FFE0A0'), borderRadius: '6px', padding: '2px 6px', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    >
                      {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))}
                      （{DOW[new Date(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)) - 1, Number(d.date.slice(8))).getDay()]}）
                      {canSeeFee && !bad && (
                        <span style={{ color: BROWN, fontWeight: 700, marginLeft: '3px' }}>
                          {d.amount != null ? d.amount.toLocaleString() + '円' + d.amountMark : d.amountNote}
                        </span>
                      )}
                      <span style={{ marginLeft: '4px', color: bad ? '#DC2626' : '#94A3B8' }}>×</span>
                    </button>
                  )
                })}
              </div>
              {stuck.length > 0 && (
                <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '6px' }}>
                  赤い{stuck.length}日はいま選べない日です（申込済み、または日付が過ぎました）。札を押して外してください
                </div>
              )}
              {canSeeFee && openByNote.map(x => (
                <div key={x.note} style={{ fontSize: '11px', color: BROWN, marginTop: '6px' }}>
                  うち{x.count}日は{OPEN_TEXT[x.note]}、合計には入れていません
                </div>
              ))}
              {canSeeFee && upCount > 0 && (
                <div style={{ fontSize: '11px', color: BROWN, marginTop: '6px' }}>
                  合計は売上が少ない日の額（下限）です。{upCount}日は売上に応じて増えます
                </div>
              )}
              {/* 時間帯は日によって違うことがある。札に入れると長くなるので、
                  違うときだけ日程の欄を見てもらう */}
              {mixedTimes && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                  時間帯は日によって異なります（上の「日程」の欄をご確認ください）
                </div>
              )}
            </>
          )}
      </div>

      {/* 記号の意味。色だけで区別すると、色の見分けが付きにくい人に伝わらない */}
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94A3B8', lineHeight: 1.8 }}>
        斜線の日は募集対象外／<span style={{ color: '#AAA' }}>×</span> は選べない日（過ぎた日、申込の上限より先、選んだ形式で出店できない曜日）／
        <span style={{ color: '#16A34A' }}>済</span> は申込済み
        {canSeeFee && <>／マスの数字は1日あたりの出店料（円）。<span style={{ color: BROWN }}>＋</span>は売上の歩合も加わる日、<span style={{ color: BROWN }}>最</span>は最低保証で決まる日</>}
      </div>
    </div>
  )
}
