'use client'
import { FORMATS, type FormatFee } from '../lib/placeFee'

// 形態（キッチンカー・物販・催事PR）ごとの出店料と条件を入れる欄。
//
// なぜ要るか:
//   出店料の設定が案件に1組しかなく、キッチンカーの金額しか入れられなかった。
//   物販や催事PRは金額が違うため、概要欄に文章で書いて運用していた。
//   文章だと出店者が見落とすうえ、売上の計算にも入らないので、
//   請求のたびに運営が手で直すことになっていた。
//
// 使わない形態は入れない。入れた形態だけが、出店者の申込画面に出る。
// 何も入れていない案件は、これまでどおり全部の形態を選べて、
// 金額も案件全体の設定を使う（既存の案件を触らずに済ませるため）。

export type FormatFeesValue = Record<string, FormatFee>

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export default function FormatFeesEditor({
  value, onChange, times,
}: {
  value: FormatFeesValue
  onChange: (v: FormatFeesValue) => void
  /** 親から渡す入力欄の見た目（案件の編集画面と揃えるため） */
  times?: string[]
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E5C07B', borderRadius: '8px',
    padding: '10px 14px', fontSize: '16px', marginTop: '6px',
    boxSizing: 'border-box', color: '#1a1a1a', background: '#fff',
  }
  const label: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#64748B' }

  const on = (f: string) => !!value[f]
  const toggle = (f: string) => {
    const next = { ...value }
    if (next[f]) delete next[f]
    else next[f] = {}
    onChange(next)
  }
  const set = (f: string, patch: Partial<FormatFee>) => {
    onChange({ ...value, [f]: { ...(value[f] || {}), ...patch } })
  }
  const num = (v: string) => {
    const t = v.replace(/[^0-9.]/g, '')
    return t === '' ? null : Number(t)
  }

  return (
    <div style={{ border: '1.5px solid #BFDBFE', borderRadius: '10px', background: '#F8FBFF', padding: '14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1D4ED8', marginBottom: '4px' }}>
        形態ごとの出店料と条件
      </div>
      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, margin: '0 0 12px' }}>
        受け入れる形態にチェックを入れて、その形態の金額と条件を入れてください。
        <strong>チェックを入れた形態だけが、出店者の申込画面に出ます。</strong><br />
        何も入れない場合は、これまでどおり全部の形態を選べて、金額は下の「料金設定」がそのまま使われます。
      </p>

      {FORMATS.map(f => {
        const v = value[f] || {}
        return (
          <div key={f} style={{ background: '#fff', border: '1px solid ' + (on(f) ? '#BFDBFE' : '#E2E8F0'), borderRadius: '9px', padding: '12px', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type='checkbox' checked={on(f)} onChange={() => toggle(f)}
                style={{ width: '18px', height: '18px', accentColor: '#1D4ED8', cursor: 'pointer' }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: on(f) ? '#1D4ED8' : '#64748B' }}>{f}</span>
              {!on(f) && <span style={{ fontSize: '11px', color: '#94A3B8' }}>この形態は受け入れない</span>}
            </label>

            {on(f) && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ ...label, color: '#B45309' }}>取引先へ渡す額（円）</label>
                    <input inputMode='numeric' value={v.placeFee ?? ''} placeholder='例：0'
                      onChange={e => set(f, { placeFee: num(e.target.value) })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...label, color: '#1D4ED8' }}>弊社の固定額（円）</label>
                    <input inputMode='numeric' value={v.companyFee ?? ''} placeholder='例：3000'
                      onChange={e => set(f, { companyFee: num(e.target.value) })} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label style={{ ...label, color: '#B45309' }}>取引先の歩合（売上の%）</label>
                    <input inputMode='decimal' value={v.sharePct ?? ''} placeholder='例：0'
                      onChange={e => set(f, { sharePct: num(e.target.value) })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...label, color: '#1D4ED8' }}>弊社の歩合（売上の%）</label>
                    <input inputMode='decimal' value={v.companySharePct ?? ''} placeholder='例：10'
                      onChange={e => set(f, { companySharePct: num(e.target.value) })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px', lineHeight: 1.7 }}>
                  空欄の項目は、下の「料金設定」の値が使われます。
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={label}>区画の条件（出店者に見えます）</label>
                  <input value={v.note ?? ''} placeholder='例：3m×5m・電源あり・車両の横付け可'
                    onChange={e => set(f, { note: e.target.value })} style={inputStyle} />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={label}>出られる曜日</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {WEEK.map((w, idx) => {
                      const sel = Array.isArray(v.dows) && v.dows.includes(idx)
                      return (
                        <button key={w} type='button'
                          onClick={() => {
                            const cur = Array.isArray(v.dows) ? v.dows : []
                            set(f, { dows: sel ? cur.filter(x => x !== idx) : [...cur, idx] })
                          }}
                          style={{ minWidth: '44px', minHeight: '44px', borderRadius: '8px', border: sel ? '1.5px solid #1D4ED8' : '1.5px solid #E2E8F0', background: sel ? '#1D4ED8' : '#fff', color: sel ? '#fff' : (idx === 0 ? '#DC2626' : idx === 6 ? '#1D4ED8' : '#64748B'), fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {w}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px', lineHeight: 1.7 }}>
                    何も選ばなければ、案件の日程すべてに出られます。
                    曜日を選ぶと、その形態はその曜日の日だけ申し込めます。
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {times ? null : null}
    </div>
  )
}
