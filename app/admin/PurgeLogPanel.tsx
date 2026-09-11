'use client'
import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

// 完全に削除した記録の控え。
//
// なぜ要るか:
//   取り消した出店は、取り消したその場で行ごと消える
//   （app/api/applications/cancel-approved/route.ts）。
//   キャンセルポリシーは次の2つを定めているので、消えたあとも
//   「誰の・どの案件の・いつの出店だったか」を引ける必要がある。
//     ・出店が確定した後は、理由・時期を問わずキャンセル料が発生する
//     ・事前の連絡なく出店されなかった場合は、応募制限またはアカウント停止
//
//   控え（purge_log）は書き込むだけで、読む画面が無かった。
//   書き込み専用の置き場になっていて、上の2つを実行できない状態だった。
//
// この画面でできること:
//   ・消した出店・請求書を新しい順に見る。出店者で絞る
//   ・1件開いて、消える前のやり取りと当日の記録を読む
//     （事前の連絡があったかどうかは、その会話にしか残っていない）
//   ・その場でキャンセル料を請求する。出店の行が消えると
//     応募者一覧の事前請求ボタンも消えるため、ここが唯一の入口になる

type LogRow = {
  id: string
  kind: 'application' | 'invoice'
  target_id: string
  summary: string | null
  seller_id: string | null
  place_id: string | null
  apply_date: string | null
  cancelled_at: string | null
  deleted_by: string | null
  deleted_at: string
  sellerName?: string
  sellerPurgeCount?: number
}

type Msg = { at: string; from: string; fromId: string; body: string; file: string | null }
type Detail = {
  format?: string | null
  wasPending?: boolean
  cancelReason?: string | null
  fee?: { formatFees?: unknown; priceFixed?: number | null; companyFixedAmount?: number | null }
  onsite?: Record<string, string | null>
  messages?: Msg[]
}

const ONSITE_LABEL: Record<string, string> = {
  confirmed_at: '出店確定',
  checked_in_at: '搬入',
  ready_at: '営業準備',
  opened_at: '営業開始',
  closed_at: '営業終了',
  left_at: '撤収',
}

export default function PurgeLogPanel() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [kind, setKind] = useState<'' | 'application' | 'invoice'>('')
  const [kw, setKw] = useState('')
  const [open, setOpen] = useState(false)

  // 1件を開いたとき
  const [pick, setPick] = useState<(LogRow & { detail?: Detail }) | null>(null)
  const [pickBusy, setPickBusy] = useState(false)

  // キャンセル料の請求
  const [billFor, setBillFor] = useState<LogRow | null>(null)
  const [billAmount, setBillAmount] = useState('')
  const [billLabel, setBillLabel] = useState('キャンセル料')
  const [billPeriod, setBillPeriod] = useState('')
  const [billDue, setBillDue] = useState('')
  const [billBusy, setBillBusy] = useState(false)
  const [billErr, setBillErr] = useState<string | null>(null)
  const [billOk, setBillOk] = useState<string | null>(null)

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const load = useCallback(async () => {
    setBusy(true); setErr(null); setNeedsSetup(false)
    try {
      const t = await token()
      const q = new URLSearchParams()
      if (kind) q.set('kind', kind)
      if (kw.trim()) q.set('kw', kw.trim())
      const res = await fetch('/api/admin/purge?' + q.toString(), {
        headers: { Authorization: 'Bearer ' + t },
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j?.error || '取得に失敗しました')
        if (j?.needsSetup) setNeedsSetup(true)
        setRows([])
        return
      }
      setRows((j.items || []) as LogRow[])
    } catch {
      setErr('通信に失敗しました。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }, [kind, kw])

  const openOne = async (r: LogRow) => {
    setPick(r); setPickBusy(true)
    try {
      const t = await token()
      const res = await fetch('/api/admin/purge?id=' + encodeURIComponent(r.id), {
        headers: { Authorization: 'Bearer ' + t },
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j?.item) setPick(j.item)
    } finally {
      setPickBusy(false)
    }
  }

  const startBill = (r: LogRow) => {
    setBillFor(r)
    setBillAmount(''); setBillLabel('キャンセル料'); setBillDue('')
    setBillErr(null); setBillOk(null)
    // 対象月は出店日の月。日付が無い控えは今月にする
    setBillPeriod(r.apply_date && /^\d{4}-\d{2}/.test(r.apply_date)
      ? r.apply_date.slice(0, 7)
      : new Date().toISOString().slice(0, 7))
  }

  const runBill = async () => {
    if (!billFor || billBusy) return
    const yen = parseInt(billAmount.replace(/[^0-9]/g, ''), 10)
    if (!yen || yen <= 0) { setBillErr('金額を入れてください。'); return }
    if (!/^\d{4}-\d{2}$/.test(billPeriod)) { setBillErr('対象月を 2026-09 の形で入れてください。'); return }
    if (!billFor.seller_id) { setBillErr('この控えには出店者が記録されていないため、ここからは請求できません。'); return }
    setBillBusy(true); setBillErr(null)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) { setBillErr('ログインしなおしてからお試しください。'); return }
      // 申込の行はもう無いので、applicationId は送らない。
      // 出店者・対象月・金額・摘要だけで1枚出す
      const res = await fetch('/api/admin/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: uid,
          action: 'advance',
          sellerId: billFor.seller_id,
          period: billPeriod,
          amount: yen,
          label: billLabel.trim() || 'キャンセル料',
          dueOn: billDue || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setBillErr(j?.error || '発行できませんでした。'); return }
      setBillOk('請求書 ' + (j?.invoiceNo || '') + ' を発行しました。「売上管理」の請求書一覧から開けます。')
    } catch {
      setBillErr('通信に失敗しました。もう一度お試しください。')
    } finally {
      setBillBusy(false)
    }
  }

  const box: React.CSSProperties = {
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px',
    padding: '14px', marginTop: '16px',
  }
  const input: React.CSSProperties = {
    border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px',
    fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box',
    minHeight: '44px', fontFamily: 'inherit', background: '#fff',
  }
  const label: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }

  return (
    <div style={box}>
      {/* 開くときにその場で読み込む。効果（useEffect）の中で読み込むと、
          読み込みの開始で状態が変わって描画が連鎖するため */}
      <button type='button' onClick={() => { const next = !open; setOpen(next); if (next) load() }}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px' }}>
        <span style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a' }}>完全に削除した記録</span>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{open ? '閉じる' : '開く'}</span>
      </button>
      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, margin: '4px 0 0' }}>
        取り消した出店は行ごと消えます。ここに控えが残ります。
        <strong>キャンセル料の請求は、ここから出してください</strong>（元の申込が無いため、応募者一覧からは出せません）。
      </p>

      {open && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <select value={kind} onChange={e => setKind(e.target.value as '' | 'application' | 'invoice')} style={input}>
              <option value=''>すべて</option>
              <option value='application'>出店</option>
              <option value='invoice'>請求書</option>
            </select>
            <input value={kw} onChange={e => setKw(e.target.value)} placeholder='案件名・出店者名・理由で探す'
              onKeyDown={e => { if (e.key === 'Enter') load() }}
              style={{ ...input, flex: '1 1 220px' }} />
            <button type='button' onClick={load} disabled={busy}
              style={{ ...input, background: '#3A9BD5', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', minWidth: '84px' }}>
              {busy ? '…' : '探す'}
            </button>
          </div>

          {err && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#B91C1C', lineHeight: 1.8, marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
              {err}
              {needsSetup && <><br />実行するまで、取り消しの控えは残りません。</>}
            </div>
          )}

          {!busy && !err && rows.length === 0 && (
            <div style={{ fontSize: '12.5px', color: '#94A3B8', padding: '10px 0' }}>控えはまだありません。</div>
          )}

          <div style={{ display: 'grid', gap: '8px' }}>
            {rows.map(r => (
              <div key={r.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', background: '#FAFBFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', border: '1px solid', borderColor: r.kind === 'application' ? '#B45309' : '#475569', color: r.kind === 'application' ? '#B45309' : '#475569' }}>
                    {r.kind === 'application' ? '出店' : '請求書'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                    {String(r.deleted_at).slice(0, 16).replace('T', ' ')} に削除
                  </span>
                  {/* 繰り返している出店者は、応募制限の判断に関わる */}
                  {r.kind === 'application' && (r.sellerPurgeCount ?? 0) >= 2 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '4px', padding: '2px 8px' }}>
                      この出店者は{r.sellerPurgeCount}件目
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 700, marginTop: '5px', lineHeight: 1.7, wordBreak: 'break-word' }}>
                  {r.summary || '(控えの説明なし)'}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <button type='button' onClick={() => openOne(r)}
                    style={{ fontSize: '12px', padding: '8px 14px', minHeight: '44px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#334155', fontWeight: 700, fontFamily: 'inherit' }}>
                    中身を見る
                  </button>
                  {r.kind === 'application' && r.seller_id && (
                    <button type='button' onClick={() => startBill(r)}
                      style={{ fontSize: '12px', padding: '8px 14px', minHeight: '44px', border: 'none', borderRadius: '8px', background: '#B45309', color: '#fff', cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                      キャンセル料を請求する
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- 1件の中身 ---- */}
      {pick && (
        <div onClick={() => setPick(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', padding: '18px', maxWidth: '620px', width: '100%', maxHeight: '86vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#1a1a1a', marginBottom: '4px' }}>消える前の記録</div>
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.8, marginBottom: '12px', wordBreak: 'break-word' }}>{pick.summary}</div>

            {pickBusy && <div style={{ fontSize: '12.5px', color: '#94A3B8' }}>読み込み中…</div>}

            {pick.detail && (
              <>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: '12.5px', margin: '0 0 14px' }}>
                  <dt style={{ color: '#64748B', fontWeight: 700 }}>形態</dt>
                  <dd style={{ margin: 0, color: '#1a1a1a' }}>{pick.detail.format || '（未選択）'}</dd>
                  <dt style={{ color: '#64748B', fontWeight: 700 }}>状態</dt>
                  <dd style={{ margin: 0, color: '#1a1a1a' }}>{pick.detail.wasPending ? '審査中のまま取消し' : '承認済みから取消し'}</dd>
                  <dt style={{ color: '#64748B', fontWeight: 700 }}>取消し理由</dt>
                  <dd style={{ margin: 0, color: '#1a1a1a', wordBreak: 'break-word' }}>{pick.detail.cancelReason || '（記載なし）'}</dd>
                </dl>

                {/* 当日どこまで進んでいたか。実際に出店したのかの判断に使う */}
                {pick.detail.onsite && Object.values(pick.detail.onsite).some(Boolean) && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ ...label, marginBottom: '6px' }}>当日の進行</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {Object.entries(pick.detail.onsite).filter(([, v]) => v).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '11.5px', border: '1px solid #BBF7D0', background: '#ECFDF5', color: '#166534', borderRadius: '4px', padding: '3px 8px' }}>
                          {ONSITE_LABEL[k] || k} {String(v).slice(11, 16)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 事前の連絡があったかどうかは、この会話にしか残っていない */}
                <div style={{ ...label, marginBottom: '6px' }}>
                  やり取り（{pick.detail.messages?.length ?? 0}件）
                </div>
                {(pick.detail.messages || []).length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#94A3B8', marginBottom: '10px' }}>
                    やり取りはありませんでした。
                    <br />
                    キャンセルポリシーは連絡をメッセージ機能で行うよう定めています。
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
                    {(pick.detail.messages || []).map((m, i) => (
                      <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', background: m.from === 'seller' ? '#FFFBEB' : '#F8FAFC' }}>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {m.from === 'seller' ? '出店者' : '運営・募集者'}　{String(m.at).slice(0, 16).replace('T', ' ')}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#1a1a1a', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body || '（本文なし）'}</div>
                        {m.file && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>添付あり（ファイルは削除済み）</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button type='button' onClick={() => setPick(null)}
              style={{ width: '100%', minHeight: '44px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#334155', fontFamily: 'inherit' }}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ---- キャンセル料の請求 ---- */}
      {billFor && (
        <div onClick={() => { if (!billBusy) setBillFor(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', padding: '18px', maxWidth: '460px', width: '100%', maxHeight: '86vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#B45309', marginBottom: '8px' }}>キャンセル料を請求します</div>
            <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.8, marginBottom: '14px', wordBreak: 'break-word' }}>
              {billFor.summary}
            </div>

            {billOk ? (
              <>
                <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#166534', lineHeight: 1.8, marginBottom: '12px' }}>
                  {billOk}
                </div>
                <button type='button' onClick={() => setBillFor(null)}
                  style={{ width: '100%', minHeight: '44px', border: 'none', borderRadius: '8px', background: '#16A34A', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 800, fontFamily: 'inherit' }}>
                  閉じる
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={label}>金額（円・税抜）</label>
                    <input inputMode='numeric' value={billAmount} disabled={billBusy}
                      onChange={e => setBillAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder='例：5000' style={{ ...input, width: '100%' }} />
                  </div>
                  <div>
                    <label style={label}>摘要（請求書に出ます）</label>
                    <input value={billLabel} disabled={billBusy}
                      onChange={e => setBillLabel(e.target.value)}
                      placeholder='例：キャンセル料' style={{ ...input, width: '100%' }} />
                  </div>
                  <div>
                    <label style={label}>対象月</label>
                    <input value={billPeriod} disabled={billBusy}
                      onChange={e => setBillPeriod(e.target.value.trim())}
                      placeholder='2026-09' style={{ ...input, width: '100%' }} />
                  </div>
                  <div>
                    <label style={label}>支払期限（任意）</label>
                    <input type='date' value={billDue} disabled={billBusy}
                      onChange={e => setBillDue(e.target.value)} style={{ ...input, width: '100%' }} />
                  </div>
                </div>

                {billErr && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#B91C1C', lineHeight: 1.8, marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
                    {billErr}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type='button' onClick={() => setBillFor(null)} disabled={billBusy}
                    style={{ flex: 1, minHeight: '44px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#334155', fontFamily: 'inherit' }}>
                    やめる
                  </button>
                  <button type='button' onClick={runBill} disabled={billBusy}
                    style={{ flex: 1, minHeight: '44px', border: 'none', borderRadius: '8px', background: '#B45309', color: '#fff', cursor: billBusy ? 'default' : 'pointer', fontSize: '13px', fontWeight: 800, fontFamily: 'inherit', opacity: billBusy ? 0.6 : 1 }}>
                    {billBusy ? '発行中…' : '請求書を発行する'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
