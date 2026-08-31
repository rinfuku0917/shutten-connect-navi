'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from './ConfirmDialog'

// 「募集終了」にする／戻すボタン。
// 管理者と、その案件を出している募集者本人だけが押せる
// （実際の判定はサーバー側で行う）。
//
// 確認は window.confirm ではなく画面内のダイアログで出す。
// スマホのアプリ内ブラウザでは confirm / alert が無視されることがあり、
// 押しても何も起きないように見えるため。

export default function ClosedToggle({
  placeId,
  closed,
  compact = false,
  onChanged,
}: {
  placeId: string
  closed: boolean
  compact?: boolean
  onChanged?: (closed: boolean) => void
}) {
  const [now, setNow] = useState(closed)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = !now

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError('ログインの有効期限が切れています。一度ログインし直してください。')
        return
      }
      const res = await fetch('/api/place-closed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ placeId, closed: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError('変更できませんでした：' + (j.error || 'エラー ' + res.status))
        return
      }
      setNow(next)
      onChanged?.(next)
      setAsking(false)
      // 公開ページにもすぐ反映させる
      try {
        await fetch('/api/revalidate-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ placeId }),
        })
      } catch { /* 反映が遅れるだけなので、失敗しても切り替えは成功として扱う */ }
    } catch {
      setError('通信に失敗しました。電波の良いところでもう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  const base: React.CSSProperties = {
    borderRadius: '6px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: compact ? '6px 12px' : '10px 16px',
    fontSize: compact ? '12px' : '13px',
    // スマホで指で押しやすい高さを確保する
    minHeight: compact ? '34px' : '44px',
    touchAction: 'manipulation',
  }

  return (
    <>
      <button
        type='button'
        onClick={() => { setError(null); setAsking(true) }}
        style={
          now
            ? { ...base, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
            : { ...base, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
        }
      >
        {now ? '募集を再開する' : '募集終了にする'}
      </button>

      <ConfirmDialog
        open={asking}
        busy={busy}
        error={error}
        danger={next}
        title={next ? 'この案件を「募集終了」にしますか？' : 'この案件の募集を再開しますか？'}
        body={
          next
            ? '掲載は残りますが、出店者はエントリーできなくなります。あとから再開できます。'
            : '出店者が再びエントリーできるようになります。'
        }
        okLabel={next ? '募集終了にする' : '募集を再開する'}
        onOk={run}
        onCancel={() => { if (!busy) { setAsking(false); setError(null) } }}
      />
    </>
  )
}
