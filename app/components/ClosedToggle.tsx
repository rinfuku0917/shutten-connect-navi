'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

// 「募集終了」にする／戻すボタン。
// 管理者と、その案件を出している募集者本人だけが押せる
// （実際の判定はサーバー側で行う）。

export default function ClosedToggle({
  placeId,
  closed,
  compact = false,
}: {
  placeId: string
  closed: boolean
  compact?: boolean
}) {
  const [now, setNow] = useState(closed)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    const next = !now
    const ok = window.confirm(
      next
        ? 'この案件を「募集終了」にしますか？\n掲載は残りますが、出店者はエントリーできなくなります。'
        : 'この案件の募集を再開しますか？',
    )
    if (!ok) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('ログインが必要です。再度ログインしてください。'); return }
      const res = await fetch('/api/place-closed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ placeId, closed: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert('変更できませんでした: ' + (j.error || res.status)); return }
      setNow(next)
    } finally {
      setBusy(false)
    }
  }

  const base: React.CSSProperties = {
    borderRadius: '6px',
    fontWeight: 700,
    cursor: busy ? 'default' : 'pointer',
    padding: compact ? '6px 12px' : '10px 16px',
    fontSize: compact ? '12px' : '13px',
    opacity: busy ? 0.6 : 1,
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      style={
        now
          ? { ...base, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
          : { ...base, background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }
      }
    >
      {busy ? '変更中...' : now ? '募集を再開する' : '募集終了にする'}
    </button>
  )
}
