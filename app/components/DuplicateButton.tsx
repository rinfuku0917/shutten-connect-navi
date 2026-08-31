'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import ConfirmDialog from './ConfirmDialog'

// 案件を複製して、そのまま編集画面をひらくボタン。
// 同じ会場で毎月募集を出すときに、前の案件を使い回すためのもの。
// 複製したものは下書きで作られるので、直してから公開する。
//
// 確認は画面内のダイアログで出す（スマホのアプリ内ブラウザでは
// window.confirm が無視され、押しても無反応に見えるため）。

export default function DuplicateButton({
  placeId,
  compact = false,
  fromAdmin = false,
}: {
  placeId: string
  compact?: boolean
  fromAdmin?: boolean
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
      const res = await fetch('/api/place-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ placeId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError('コピーできませんでした：' + (j.error || 'エラー ' + res.status))
        return
      }
      router.push('/dashboard/host/edit-place/' + j.place.id + (fromAdmin ? '?from=admin' : ''))
    } catch {
      setError('通信に失敗しました。電波の良いところでもう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type='button'
        onClick={() => { setError(null); setAsking(true) }}
        title='この案件をコピーして新しい案件を作ります'
        style={{
          background: '#F5F3FF',
          color: '#5B21B6',
          border: '1px solid #DDD6FE',
          borderRadius: '6px',
          fontWeight: 700,
          cursor: 'pointer',
          padding: compact ? '4px 10px' : '7px 12px',
          fontSize: compact ? '11px' : '12px',
          minHeight: compact ? '34px' : '44px',
          touchAction: 'manipulation',
        }}
      >
        コピーして新規作成
      </button>

      <ConfirmDialog
        open={asking}
        busy={busy}
        error={error}
        title='この案件をコピーしますか？'
        body='下書きとしてコピーを作り、編集画面をひらきます。内容を直してから公開してください。'
        okLabel='コピーする'
        onOk={run}
        onCancel={() => { if (!busy) { setAsking(false); setError(null) } }}
      />
    </>
  )
}
