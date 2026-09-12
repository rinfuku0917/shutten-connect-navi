'use client'
import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

// 経理用スプレッドシートへの連携の状態。
//
// なぜ画面に出すか:
//   送信は外へのHTTPなので必ず失敗しうる（通信が切れた、Apps Script の
//   実行上限、URLを貼り替えた途中）。黙って捨てると、経理のシートに
//   行が欠けたまま誰も気づかない。それがこの機能でいちばん困る結果なので、
//   「送れていないものが何件あるか」を常に見られるようにしておく。
//
// 置き方（Apps Script の貼り方とVercelの環境変数）は
// docs/sheet-webhook.gs の冒頭に書いてある。

export default function SheetSyncPanel() {
  const [state, setState] = useState<{
    configured?: boolean
    pending?: number
    lastError?: string | null
    needsSetup?: boolean
    error?: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendMsg, setSendMsg] = useState<string | null>(null)

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const load = useCallback(async () => {
    setBusy(true); setSendMsg(null)
    try {
      const res = await fetch('/api/sheets/sales', { headers: { Authorization: 'Bearer ' + (await token()) } })
      const j = await res.json().catch(() => ({}))
      setState(j)
    } catch {
      setState({ error: '通信に失敗しました。もう一度お試しください。' })
    } finally {
      setBusy(false)
    }
  }, [])

  const retry = async () => {
    if (busy) return
    setBusy(true); setSendMsg(null)
    try {
      const res = await fetch('/api/sheets/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
        body: JSON.stringify({ retryPending: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setSendMsg('送れませんでした：' + (j?.error || '原因は分かりませんでした'))
      else if (j?.skipped) setSendMsg('連携の設定（SHEET_WEBHOOK_URL／SHEET_WEBHOOK_SECRET）が入っていません。')
      else setSendMsg((j?.sent ?? 0) + '件を送りました。')
    } catch {
      setSendMsg('通信に失敗しました。もう一度お試しください。')
    } finally {
      setBusy(false)
      // 件数を取り直す
      try {
        const res = await fetch('/api/sheets/sales', { headers: { Authorization: 'Bearer ' + (await token()) } })
        setState(await res.json().catch(() => ({})))
      } catch { /* 件数が古いままでも操作はできる */ }
    }
  }

  const pending = state?.pending ?? 0

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a' }}>経理用スプレッドシート連携</span>
        {state && (
          state.configured
            ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '4px', padding: '2px 8px' }}>設定済み</span>
            : <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '4px', padding: '2px 8px' }}>未設定</span>
        )}
        <button type='button' onClick={load} disabled={busy}
          style={{ marginLeft: 'auto', fontSize: '12px', padding: '8px 14px', minHeight: '44px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', cursor: busy ? 'default' : 'pointer', color: '#334155', fontWeight: 700, fontFamily: 'inherit' }}>
          {busy ? '…' : state ? '状態を取り直す' : '状態を見る'}
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, margin: '6px 0 0' }}>
        売上が報告されたとき、請求書を発行・取り消したとき、入金を確認したときに、
        経理用のシートへ自動で反映します（同じ売上は上書きされるので二重に並びません）。
      </p>

      {state?.needsSetup && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#92400E', lineHeight: 1.8, marginTop: '10px' }}>
          {state.error}
        </div>
      )}

      {state && !state.needsSetup && !state.error && (
        <div style={{ marginTop: '10px' }}>
          {!state.configured && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#92400E', lineHeight: 1.8, marginBottom: '10px' }}>
              まだ連携していません。経理用シートの「拡張機能 → Apps Script」に
              <code style={{ background: '#fff', padding: '1px 5px', borderRadius: '4px', margin: '0 3px' }}>docs/sheet-webhook.gs</code>
              を貼ってデプロイし、出てきた URL と合い鍵を Vercel の環境変数
              （SHEET_WEBHOOK_URL / SHEET_WEBHOOK_SECRET）に入れて再デプロイしてください。
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: pending > 0 ? '#B91C1C' : '#15803D', fontWeight: 800 }}>
              未送信 {pending.toLocaleString()}件
            </span>
            {pending > 0 && (
              <button type='button' onClick={retry} disabled={busy || !state.configured}
                style={{ fontSize: '12px', padding: '8px 14px', minHeight: '44px', border: 'none', borderRadius: '8px', background: state.configured ? '#3A9BD5' : '#CBD5E1', color: '#fff', cursor: (busy || !state.configured) ? 'default' : 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                {busy ? '送信中…' : 'いま送り直す'}
              </button>
            )}
            {pending > 200 && (
              <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                1回で送るのは200件までです。残りはもう一度押してください。
              </span>
            )}
          </div>

          {sendMsg && (
            <div style={{ fontSize: '12.5px', color: sendMsg.includes('送りました') ? '#15803D' : '#B91C1C', lineHeight: 1.8, marginTop: '8px', whiteSpace: 'pre-wrap' }}>
              {sendMsg}
            </div>
          )}

          {/* 直近の失敗の理由。合い鍵の間違いとデプロイ忘れがいちばん多い */}
          {state.lastError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#B91C1C', lineHeight: 1.8, marginTop: '10px', wordBreak: 'break-word' }}>
              <strong>直近の失敗</strong><br />{state.lastError}
            </div>
          )}
        </div>
      )}

      {state?.error && !state.needsSetup && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#B91C1C', lineHeight: 1.8, marginTop: '10px' }}>
          {state.error}
        </div>
      )}
    </div>
  )
}
