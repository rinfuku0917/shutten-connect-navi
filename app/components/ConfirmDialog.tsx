'use client'
import { useEffect } from 'react'

// 画面の中に出す確認ダイアログ。
//
// もともと window.confirm を使っていたが、スマホでボタンを押しても
// 何も起きない、という報告があった。LINE や Instagram のアプリ内ブラウザ、
// および一部のスマホ設定では confirm / alert が黙って無視されるため、
// 押しても反応がないように見えてしまう。
// 自前の画面で出せば、どの環境でも同じように動く。

export default function ConfirmDialog({
  open,
  title,
  body,
  okLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger = false,
  busy = false,
  error = null,
  extra,
  onOk,
  onCancel,
}: {
  open: boolean
  title: string
  body?: string
  okLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  /** 本文とボタンの間に置く追加の操作。メールを送るかどうかの選択などに使う */
  extra?: React.ReactNode
  onOk: () => void
  onCancel: () => void
}) {
  // 開いている間は後ろの画面を動かさない
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Esc で閉じられるように（パソコン向け）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  const btn: React.CSSProperties = {
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '14px',
    padding: '12px 18px',
    cursor: busy ? 'wait' : 'pointer',
    // スマホで押しやすいように、指1本分の高さを確保する
    minHeight: '44px',
    flex: 1,
  }

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-label={title}
      onClick={() => { if (!busy) onCancel() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        // ヘッダーが z-index:100 なので、それより確実に上に出す
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '22px 20px 18px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 800, color: '#111', marginBottom: body ? '10px' : '18px' }}>{title}</div>
        {body && (
          <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.8, marginBottom: '18px', whiteSpace: 'pre-wrap' }}>{body}</div>
        )}

        {extra && <div style={{ marginBottom: '16px' }}>{extra}</div>}

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.7, marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ ...btn, background: '#fff', color: '#475569', border: '1px solid #CBD5E1' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onOk}
            disabled={busy}
            style={{
              ...btn,
              background: busy ? '#94A3B8' : danger ? '#DC2626' : '#F5A623',
              color: '#fff',
              border: 'none',
            }}
          >
            {busy ? '処理中…' : okLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
