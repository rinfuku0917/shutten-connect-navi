'use client'

// 曜日のまとめ選び（毎日／平日だけ／土日だけ）。
//
// なぜ切り出したか:
//   同じ3つのボタンを、まとめて日程追加と毎月の自動更新の2か所に
//   その場書きで置いていた。形態ごとの「出られる曜日」にも同じものが欲しい
//   という相談があり、3か所目をまた書き写すと、文言や並びが少しずつ
//   食い違っていく。1か所にまとめて、同じ見た目・同じ言い方にする。
//
// 「土日だけ」に祝日は入らない。
//   ここで選ぶのは曜日（0=日 … 6=土）なので、月曜の祝日は「平日だけ」に入る。
//   金額の平日／土日祝の出し分け（app/lib/jpHoliday.ts の isWeekendOrHoliday）は
//   祝日を土日と同じ扱いにするが、それとは別のしくみ。
//   ラベルを「土日祝だけ」にすると嘘になるので「土日だけ」にしている。

/** 毎日（日〜土） */
export const DOWS_ALL = [0, 1, 2, 3, 4, 5, 6]
/** 平日だけ（月〜金） */
export const DOWS_WEEKDAY = [1, 2, 3, 4, 5]
/** 土日だけ（日・土）。祝日は含まない */
export const DOWS_WEEKEND = [0, 6]

const PRESETS: { label: string; dows: number[] }[] = [
  { label: '毎日', dows: DOWS_ALL },
  { label: '平日だけ', dows: DOWS_WEEKDAY },
  { label: '土日だけ', dows: DOWS_WEEKEND },
]

export default function DowPresets({
  onPick, current, disabled,
}: {
  onPick: (dows: number[]) => void
  /** いま選ばれている曜日。一致するまとめに印を付けるために使う（任意） */
  current?: number[] | null
  disabled?: boolean
}) {
  const same = (a: number[]) => {
    if (!Array.isArray(current)) return false
    if (current.length !== a.length) return false
    const s = [...current].sort((x, y) => x - y)
    return a.every((v, i) => s[i] === v)
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
      {PRESETS.map(p => {
        const on = same(p.dows)
        return (
          <button key={p.label} type='button' disabled={disabled}
            onClick={() => onPick([...p.dows])}
            style={{
              background: on ? '#EFF6FF' : '#fff',
              color: on ? '#1D4ED8' : '#64748B',
              border: '1px solid ' + (on ? '#BFDBFE' : '#E2E8F0'),
              borderRadius: '999px', padding: '6px 12px',
              fontSize: '11.5px', fontWeight: 700,
              cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: disabled ? 0.6 : 1,
            }}>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
