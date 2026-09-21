'use client'
import { useState } from 'react'
import { FORMATS, hasFormatMin, dayFeeOf, minFeeOn, formatShare, type FormatFee, type FeeSource } from '../lib/placeFee'
import DowPresets from './DowPresets'

// 形態（キッチンカー・物販・催事PR・テント・ブース）ごとの出店料と条件を入れる欄。
//
// なぜ要るか:
//   出店料の設定が案件に1組しかなく、キッチンカーの金額しか入れられなかった。
//   物販や催事PRは金額が違うため、概要欄に文章で書いて運用していた。
//   文章だと出店者が見落とすうえ、売上の計算にも入らないので、
//   請求のたびに運営が手で直すことになっていた。
//
// 平日と土日祝で分けられる:
//   最初は形態ごとに1組しか入れられず、「平日3,000円・土日4,500円」のような
//   案件を入れられなかった。上の欄を平日（分けないときは全日）、
//   チェックを入れると出てくる欄を土日祝にしている。
//   まとめて日程追加の料金欄と同じ形にしてある。
//
// 最低保証:
//   「売上の20%。ただし売上が悪くても平日2,000円・土日祝7,500円はいただく」
//   という案件のための下限。歩合の欄のすぐ下に、別の箱として置いている。
//   固定額の「平日と土日祝で分ける」と同じ箱にしないのは、そちらのチェックを
//   外すと weekend が丸ごと消える作りのため（最低保証まで一緒に消えてしまう）。
//
// 使わない形態は入れない。入れた形態だけが、出店者の申込画面に出る。
// 何も入れていない案件は、これまでどおり全部の形態を選べて、
// 金額も案件全体の設定を使う（既存の案件を触らずに済ませるため）。

export type FormatFeesValue = Record<string, FormatFee>

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

// 実額の例に使う見本の日付（平日）。6月は祝日が1日も無いので、
// 何年経っても平日として判定される
const EX_DATE = '2026-06-03'

export default function FormatFeesEditor({
  value, onChange, times, place,
}: {
  value: FormatFeesValue
  onChange: (v: FormatFeesValue) => void
  /** 親から渡す入力欄の見た目（案件の編集画面と揃えるため） */
  times?: string[]
  /**
   * いま編集している案件の、案件全体の料金設定（固定額・歩合・日程の各日の額・最低保証）。
   *
   * 形態に入れていない項目は案件全体の設定に落ちるので、実額の例をそこまで含めて
   * 計算するために受け取る。渡さないと、歩合を案件全体にだけ入れている案件で
   * 「売上が増えても最低保証のまま」という実際より少ない額を見せてしまう。
   */
  place?: FeeSource
}) {
  // 「土日祝だけ分ける」を開いているか。形態ごとに覚える。
  // 既に土日祝の額が入っている形態は、最初から開いた状態で出す
  const [split, setSplit] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const f of FORMATS) {
      const w = value[f]?.weekend
      if (w && (typeof w.placeFee === 'number' || typeof w.companyFee === 'number')) init[f] = true
    }
    return init
  })
  // 「最低保証を設定する」を開いているか。形態ごとに覚える。
  // 固定額の split とは別に持つ（どちらの金額の話かを混ぜない）
  const [minOn, setMinOn] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const f of FORMATS) if (hasFormatMin(value, f)) init[f] = true
    return init
  })
  // 「最低保証を平日と土日祝で分ける」を開いているか
  const [minSplit, setMinSplit] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const f of FORMATS) {
      const w = value[f]?.min?.weekend
      if (w && (typeof w.placeFee === 'number' || typeof w.companyFee === 'number')) init[f] = true
    }
    return init
  })

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
  // 土日祝の額だけを書き換える
  const setWeekend = (f: string, patch: { placeFee?: number | null; companyFee?: number | null }) => {
    const cur = value[f] || {}
    onChange({ ...value, [f]: { ...cur, weekend: { ...(cur.weekend || {}), ...patch } } })
  }
  const num = (v: string) => {
    const t = v.replace(/[^0-9.]/g, '')
    return t === '' ? null : Number(t)
  }
  // チェックを外したら、土日祝に入れていた額も消す。
  // 残しておくと、画面に出ていない額で計算されることになる
  const toggleSplit = (f: string, want: boolean) => {
    setSplit(s => ({ ...s, [f]: want }))
    if (!want && value[f]?.weekend) {
      const cur = { ...(value[f] || {}) }
      delete cur.weekend
      onChange({ ...value, [f]: cur })
    }
  }
  // 最低保証（平日、および土日祝を分けないときの額）を書き換える
  const setMin = (f: string, patch: { placeFee?: number | null; companyFee?: number | null }) => {
    const cur = value[f] || {}
    onChange({ ...value, [f]: { ...cur, min: { ...(cur.min || {}), ...patch } } })
  }
  // 土日祝の最低保証だけを書き換える
  const setMinWeekend = (f: string, patch: { placeFee?: number | null; companyFee?: number | null }) => {
    const cur = value[f] || {}
    const curMin = cur.min || {}
    onChange({ ...value, [f]: { ...cur, min: { ...curMin, weekend: { ...(curMin.weekend || {}), ...patch } } } })
  }
  // 最低保証のチェックを外したら min を丸ごと消す。
  // 残しておくと、画面に出ていない額で計算されることになる（toggleSplit と同じ考え）
  const toggleMin = (f: string, want: boolean) => {
    setMinOn(s => ({ ...s, [f]: want }))
    if (!want && value[f]?.min) {
      const cur = { ...(value[f] || {}) }
      delete cur.min
      onChange({ ...value, [f]: cur })
    }
  }
  const toggleMinSplit = (f: string, want: boolean) => {
    setMinSplit(s => ({ ...s, [f]: want }))
    if (!want && value[f]?.min?.weekend) {
      const cur = { ...(value[f] || {}) }
      const curMin = { ...(cur.min || {}) }
      delete curMin.weekend
      onChange({ ...value, [f]: { ...cur, min: curMin } })
    }
  }

  return (
    <div style={{ border: '1.5px solid #BFDBFE', borderRadius: '10px', background: '#F8FBFF', padding: '14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1D4ED8', marginBottom: '4px' }}>
        形態ごとの出店料と条件
      </div>
      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, margin: '0 0 12px' }}>
        受け入れる形態にチェックを入れて、その形態の金額と条件を入れてください。
        <strong>チェックを入れた形態だけが、出店者の申込画面に出ます。</strong><br />
        何も入れない場合は、これまでどおり全部の形態を選べて、金額は下の「料金設定」がそのまま使われます。<br />
        歩合の案件で「売上が少ない日はこの額」という下限があるときは、歩合の欄の下の<strong>最低保証</strong>に入れてください。
      </p>

      {FORMATS.map(f => {
        const v = value[f] || {}
        const isSplit = !!split[f]
        const isMinOn = !!minOn[f]
        const isMinSplit = !!minSplit[f]
        // 実額の確認。計算は dayFeeOf に任せる（入力画面と請求で別の式にしない）。
        // 見本の日付は平日（6月は祝日が無いので判定が変わらない）。
        // 案件全体の設定に形態だけを差し替えて渡す。形態側に入れていない
        // 固定額や歩合は案件全体に落ちるので、そこまで入れないと実額と違う額が出る
        const exSrc: FeeSource = { ...(place || {}), format_fees: { [f]: v } }
        const minEx = isMinOn
          ? { high: dayFeeOf(exSrc, f, EX_DATE, 30000), low: dayFeeOf(exSrc, f, EX_DATE, 5000) }
          : null
        // 最低保証の配分が歩合の配分と違うと、出店者の合計が
        // 「歩合の合計」も「最低保証の合計」も上回る日が出る。その日の例を出す。
        // 最低保証も歩合も、形態に入れていなければ案件全体に落ちるので同じ落ち方で読む
        const ratioWarn = (() => {
          if (!isMinOn) return null
          const exMin = minFeeOn(exSrc, f, EX_DATE)
          const exShare = formatShare(exSrc.format_fees, f)
          const mp = exMin.placeFee || 0, mc = exMin.companyFee || 0
          const sp = exShare.sharePct ?? place?.price_share_pct ?? 0
          const sc = exShare.companySharePct ?? place?.company_share_pct ?? 0
          if (mp + mc === 0 || sp + sc === 0) return null
          if (Math.abs(mp / (mp + mc) - sp / (sp + sc)) < 0.01) return null
          // 片側だけ最低保証が効く売上を探す（両方の境目の間）
          const bp = mp / (sp / 100 || Infinity), bc = mc / (sc / 100 || Infinity)
          const rev = Math.round((Math.min(bp, bc) + Math.max(bp, bc)) / 2)
          if (!isFinite(rev) || rev <= 0) return null
          const r = dayFeeOf(exSrc, f, EX_DATE, rev)
          const pctTotal = Math.floor(rev * sp / 100) + Math.floor(rev * sc / 100)
          const minTotal = mp + mc
          if (r.total <= Math.max(pctTotal, minTotal)) return null
          return { rev, total: r.total, minTotal, pctTotal }
        })()
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
                {/* 平日と土日祝で金額が違う案件が多いので、1回で両方入れられるようにする。
                    まとめて日程追加の料金欄と同じ形 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type='checkbox' checked={isSplit} onChange={e => toggleSplit(f, e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#1D4ED8', cursor: 'pointer' }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1D4ED8' }}>固定額を平日と土日祝で分ける</span>
                </label>

                <div style={{ background: '#fff', border: '1px solid #DBEAFE', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                    {isSplit ? '平日の金額' : '金額'}
                  </div>
                  <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ ...label, color: '#B45309' }}>取引先へ渡す額（円）</label>
                      <input inputMode='numeric' value={v.placeFee ?? ''} placeholder='例：13000'
                        onChange={e => set(f, { placeFee: num(e.target.value) })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ ...label, color: '#1D4ED8' }}>弊社の固定額（円）</label>
                      <input inputMode='numeric' value={v.companyFee ?? ''} placeholder='例：5000'
                        onChange={e => set(f, { companyFee: num(e.target.value) })} style={inputStyle} />
                    </div>
                  </div>
                </div>

                {isSplit && (
                  <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#DC2626', marginBottom: '2px' }}>土日祝の金額</div>
                    <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ ...label, color: '#B45309' }}>取引先へ渡す額（円）</label>
                        <input inputMode='numeric' value={v.weekend?.placeFee ?? ''} placeholder='例：4500'
                          onChange={e => setWeekend(f, { placeFee: num(e.target.value) })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ ...label, color: '#1D4ED8' }}>弊社の固定額（円）</label>
                        <input inputMode='numeric' value={v.weekend?.companyFee ?? ''} placeholder='空欄可'
                          onChange={e => setWeekend(f, { companyFee: num(e.target.value) })} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.8 }}>
                  {isSplit
                    ? <>土日と祝日には「土日祝の金額」、それ以外の日には「平日の金額」が使われます。<br />土日祝で空欄にした欄は、平日の金額がそのまま使われます。</>
                    : <>この形態は、どの日も同じ金額になります。空欄の項目は、下の「料金設定」の値が使われます。</>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
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
                {/* 歩合の範囲（0〜100）の警告は出さない。
                    金額も%も自由入力にする方針（2026-09-21 の指示）。
                    案件ごとの条件は運営が契約どおりに入れるので、
                    サイト側で範囲を決めて注意を出すことはしない */}
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px', lineHeight: 1.7 }}>
                  歩合は日によって変えられません（売上に対する率なので、日で変える必要が実務上ないため）。
                </div>

                {/* 最低保証（歩合が少ない日の下限）。
                    歩合が無いと意味が無い設定なので、歩合の欄のすぐ下に置く。
                    上の「固定額を平日と土日祝で分ける」とは別の設定なので、
                    枠の色を変え、チェックも別に持つ（min は weekend と独立して保存される）。 */}
                <div style={{ border: '1.5px solid #BBF7D0', background: '#F0FDF4', borderRadius: '9px', padding: '12px', marginTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type='checkbox' checked={isMinOn} onChange={e => toggleMin(f, e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#16A34A', cursor: 'pointer' }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#16A34A' }}>最低保証を設定する（売上が少ない日の下限）</span>
                  </label>
                  {isMinOn && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input type='checkbox' checked={isMinSplit} onChange={e => toggleMinSplit(f, e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#16A34A', cursor: 'pointer' }} />
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#16A34A' }}>最低保証を平日と土日祝で分ける</span>
                      </label>
                      <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '2px' }}>
                          {isMinSplit ? '平日の最低保証' : '最低保証'}
                        </div>
                        <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ ...label, color: '#B45309' }}>取引先へ渡す額（円）</label>
                            <input inputMode='numeric' value={v.min?.placeFee ?? ''} placeholder='例：1500'
                              onChange={e => setMin(f, { placeFee: num(e.target.value) })} style={inputStyle} />
                          </div>
                          <div>
                            <label style={{ ...label, color: '#1D4ED8' }}>弊社の取り分（円）</label>
                            <input inputMode='numeric' value={v.min?.companyFee ?? ''} placeholder='例：500'
                              onChange={e => setMin(f, { companyFee: num(e.target.value) })} style={inputStyle} />
                          </div>
                        </div>
                      </div>
                      {isMinSplit && (
                        <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#DC2626', marginBottom: '2px' }}>土日祝の最低保証</div>
                          <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ ...label, color: '#B45309' }}>取引先へ渡す額（円）</label>
                              <input inputMode='numeric' value={v.min?.weekend?.placeFee ?? ''} placeholder='例：5625'
                                onChange={e => setMinWeekend(f, { placeFee: num(e.target.value) })} style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ ...label, color: '#1D4ED8' }}>弊社の取り分（円）</label>
                              <input inputMode='numeric' value={v.min?.weekend?.companyFee ?? ''} placeholder='空欄可'
                                onChange={e => setMinWeekend(f, { companyFee: num(e.target.value) })} style={inputStyle} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '8px', lineHeight: 1.8 }}>
                        歩合で計算した額がこの額を下回った日は、この額をいただきます（<strong>合算ではありません</strong>）。
                        <strong>税別</strong>で入れてください。<br />
                        {isMinSplit
                          ? <>土日と祝日には「土日祝の最低保証」、それ以外の日には「平日の最低保証」が使われます。土日祝で空欄にした欄は、平日の額がそのまま使われます。</>
                          : <>どの日も同じ額が下限になります。</>}
                        <br />歩合を入れない場合は、固定額と同じ動きになります。
                      </div>
                      {/* いくらになるのか、実額で確かめられるようにする */}
                      {minEx && (
                        <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '8px', lineHeight: 1.9, background: '#fff', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '8px 10px' }}>
                          <div style={{ fontWeight: 800, color: '#16A34A' }}>この設定だと（平日の例）</div>
                          売上30,000円の日：<strong>{minEx.high.total.toLocaleString()}円</strong>{(minEx.high.placeMinApplied || minEx.high.companyMinApplied) ? '（最低保証）' : '（歩合と固定額で計算）'}<br />
                          売上5,000円の日：<strong>{minEx.low.total.toLocaleString()}円</strong>{(minEx.low.placeMinApplied || minEx.low.companyMinApplied) ? '（最低保証）' : '（歩合と固定額で計算）'}
                        </div>
                      )}
                      {/* 取引先側と弊社側は別々に「高い方」を取るため、
                          最低保証の比が歩合の比と違うと、出店者の合計が
                          「歩合の合計」も「最低保証の合計」も上回る日が出る */}
                      {ratioWarn && (
                        <div style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '8px', lineHeight: 1.8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 10px' }}>
                          この配分だと、売上{ratioWarn.rev.toLocaleString()}円の日に出店者の合計が
                          <strong>{ratioWarn.total.toLocaleString()}円</strong>（最低保証の合計 {ratioWarn.minTotal.toLocaleString()}円／歩合の合計 {ratioWarn.pctTotal.toLocaleString()}円）になります。
                          最低保証は歩合と同じ比で割ることをおすすめします。
                        </div>
                      )}
                    </div>
                  )}
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
                            // 押した順ではなく日→土の並びで持つ。
                            // 出店者の画面にそのまま出るため
                            const next = sel ? cur.filter(x => x !== idx) : [...cur, idx]
                            set(f, { dows: next.sort((a, b) => a - b) })
                          }}
                          style={{ minWidth: '44px', minHeight: '44px', borderRadius: '8px', border: sel ? '1.5px solid #1D4ED8' : '1.5px solid #E2E8F0', background: sel ? '#1D4ED8' : '#fff', color: sel ? '#fff' : (idx === 0 ? '#DC2626' : idx === 6 ? '#1D4ED8' : '#64748B'), fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {w}
                        </button>
                      )
                    })}
                  </div>
                  {/* まとめて選べるようにする。1つずつ押すのは手間で、
                      まとめて日程追加と毎月の自動更新には既に同じものがある。
                      同じ部品を使って、言い方と見た目を揃えている */}
                  <DowPresets current={Array.isArray(v.dows) ? v.dows : null}
                    onPick={dows => set(f, { dows })} />
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px', lineHeight: 1.7 }}>
                    何も選ばなければ、案件の日程すべてに出られます。
                    曜日を選ぶと、その形態はその曜日の日だけ申し込めます。<br />
                    「土日だけ」に祝日は入りません（月曜の祝日は「平日だけ」に入ります）。
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
