'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

// 会員ぜんぶへ注意喚起を送る欄。
//
// なぜ要るか（2026-10-02）:
//   弊社の社員を名乗り、LINEのQRコードと所属・役職を返信させようとする
//   偽のメールが届いた。会員にも同じものが届いている可能性があり、
//   至急お知らせする必要があったが、一斉にお知らせする手立てが無かった。
//
// 押し間違いで1,400通を超える本物のメールが飛ばないように、
//   1. まず「宛先と文面を確かめる」（1通も送らない）
//   2. 文面を見たうえで「この400件に送る」を押す
//   3. 送ったら次の400件に進む
// の3段にしている。何件目まで送ったかは画面が覚える。

type Dry = {
  宛先の総数: number | null
  この回の宛先: number
  この回の範囲: string
  次のoffset: number
  文面の見本: { 件名: string; 本文: string } | null
}
type Sent = {
  sent: number
  この回の範囲: string
  次のoffset: number
  残り: number
  エラー件数: number
  errors: string[]
}

export default function SecurityNotice({ onEditMail }: { onEditMail: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(
    '・差出人名：「（業務連絡）株式会社ｎａｖ」／「山根拓也」\n'
    + '・返信先：kenneth_maddencmkp@outlook.jp（弊社のアドレスではありません）\n'
    + '・LINEのQRコードと、所属部署・役職を返信するよう求める内容',
  )
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dry, setDry] = useState<Dry | null>(null)
  const [log, setLog] = useState<Sent[]>([])

  const token = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  const call = async (send: boolean) => {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const t = await token()
      if (!t) { setErr('ログインの有効期限が切れています。読み込み直してください。'); return }
      const res = await fetch('/api/admin/security-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ send, offset, detail }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(j.error || '失敗しました'); return }
      if (send) {
        setLog(prev => [...prev, j as Sent])
        setOffset(j['次のoffset'] ?? offset)
        setDry(null)
      } else {
        setDry(j as Dry)
      }
    } finally {
      setBusy(false)
    }
  }

  const box = { border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 11px', fontSize: '13px', color: '#1a1a1a', fontFamily: 'inherit', boxSizing: 'border-box' as const, width: '100%' }
  const sentTotal = log.reduce((t, l) => t + (l.sent || 0), 0)

  return (
    <div style={{ border: '1.5px solid #FECACA', background: '#FEF2F2', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#B91C1C' }}>
          偽メールの注意喚起を会員へ送る
        </div>
        <button type='button' onClick={() => setOpen(o => !o)}
          style={{ border: '1px solid #FECACA', background: '#fff', color: '#B91C1C', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {open ? '閉じる' : '開く'}
        </button>
        {sentTotal > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#B91C1C' }}>これまでに {sentTotal}通 送信</span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#7F1D1D', lineHeight: 1.9, marginBottom: '10px' }}>
            出店者・募集者ぜんぶ（運営は除く）へ、1通ずつ送ります。<strong>本物のメールが飛びます。</strong>
            <br />
            まず「宛先と文面を確かめる」で中身を見てから送ってください。1回で400件まで送り、続きは「次の400件へ」で進みます。
          </div>

          <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#7F1D1D' }}>
            偽メールの特徴（本文にそのまま入ります）
            <textarea value={detail} onChange={e => setDetail(e.target.value)} disabled={busy}
              style={{ ...box, minHeight: '92px', marginTop: '5px', lineHeight: 1.8, resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
            <button type='button' onClick={() => call(false)} disabled={busy}
              style={{ background: '#fff', border: '1.5px solid #B91C1C', color: '#B91C1C', borderRadius: '8px', padding: '9px 16px', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? '確認中…' : '宛先と文面を確かめる（送りません）'}
            </button>
            <span style={{ fontSize: '11.5px', color: '#7F1D1D' }}>
              次に送るのは {offset + 1}件目から
            </span>
            <button type='button' onClick={() => onEditMail('security-notice')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '11.5px', color: '#B91C1C', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
              文面を編集する
            </button>
          </div>

          {err && (
            <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #FECACA', borderRadius: '8px', padding: '9px 11px', fontSize: '12px', color: '#B91C1C', lineHeight: 1.8 }}>{err}</div>
          )}

          {dry && (
            <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #FECACA', borderRadius: '8px', padding: '11px 13px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.9 }}>
                宛先ぜんぶ {dry.宛先の総数}人 ／ この回に送るのは <strong style={{ color: '#B91C1C' }}>{dry.この回の宛先}通</strong>（{dry.この回の範囲}）
              </div>
              {dry.文面の見本 && (
                <>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', margin: '8px 0 4px' }}>この文面で送ります（1人目の例）</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>件名：{dry.文面の見本.件名}</div>
                  <pre style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.85, color: '#334155', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontFamily: 'inherit', maxHeight: '320px', overflowY: 'auto' }}>
                    {dry.文面の見本.本文}
                  </pre>
                </>
              )}
              <button type='button' onClick={() => call(true)} disabled={busy || dry.この回の宛先 === 0}
                style={{ marginTop: '10px', background: busy || dry.この回の宛先 === 0 ? '#CBD5E1' : '#B91C1C', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 800, cursor: busy || dry.この回の宛先 === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '40px' }}>
                {busy ? '送信中…（閉じないでください）' : `この${dry.この回の宛先}通を送る`}
              </button>
            </div>
          )}

          {log.length > 0 && (
            <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#334155', lineHeight: 1.9 }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>送信の記録</div>
              {log.map((l, i) => (
                <div key={i}>
                  {l.この回の範囲}：{l.sent}通 送信
                  {l.エラー件数 > 0 && <span style={{ color: '#B91C1C', fontWeight: 700 }}>／失敗 {l.エラー件数}件</span>}
                  {l.残り > 0 && <span style={{ color: '#64748B' }}>／残り {l.残り}人</span>}
                </div>
              ))}
              {log[log.length - 1]?.残り > 0 && (
                <button type='button' onClick={() => call(false)} disabled={busy}
                  style={{ marginTop: '6px', background: '#fff', border: '1.5px solid #B91C1C', color: '#B91C1C', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  次の400件へ（{(log[log.length - 1]?.次のoffset ?? 0) + 1}件目から）
                </button>
              )}
              {log[log.length - 1]?.errors?.length > 0 && (
                <div style={{ marginTop: '6px', color: '#B91C1C', fontSize: '11.5px' }}>
                  {log[log.length - 1].errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
