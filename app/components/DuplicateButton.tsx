'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// 案件を複製して、そのまま編集画面をひらくボタン。
// 同じ会場で毎月募集を出すときに、前の案件を使い回すためのもの。
// 複製したものは下書きで作られるので、直してから公開する。

export default function DuplicateButton({
  placeId,
  compact = false,
  fromAdmin = false,
}: {
  placeId: string
  compact?: boolean
  fromAdmin?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const run = async () => {
    if (!window.confirm('この案件をコピーして、新しい案件を作りますか？\n下書きで作成し、編集画面をひらきます。')) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('ログインが必要です。再度ログインしてください。'); return }
      const res = await fetch('/api/place-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ placeId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert('コピーできませんでした: ' + (j.error || res.status)); return }
      router.push('/dashboard/host/edit-place/' + j.place.id + (fromAdmin ? '?from=admin' : ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      title='この案件をコピーして新しい案件を作ります'
      style={{
        background: '#F5F3FF',
        color: '#5B21B6',
        border: '1px solid #DDD6FE',
        borderRadius: '6px',
        fontWeight: 700,
        cursor: busy ? 'wait' : 'pointer',
        padding: compact ? '4px 10px' : '7px 12px',
        fontSize: compact ? '11px' : '12px',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? 'コピー中…' : 'コピーして新規作成'}
    </button>
  )
}
