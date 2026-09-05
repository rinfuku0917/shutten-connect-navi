'use client'
import { useEffect } from 'react'

// 画面の上に出す、短いお知らせ。
//
// もともと alert() で出していたが、LINE や Instagram のアプリ内ブラウザでは
// alert も confirm も黙って無視される。「削除に失敗」などの知らせが
// 一切見えないまま、何も起きなかったように見えていた。
// 画面の中に出せば、どの環境でも同じように見える。
//
// 使い方: 親が message を持ち、閉じたら空にする。
// 数秒たつと自動で消える（失敗の知らせは長めに残す）。

export default function Notice({
  message,
  kind = 'error',
  onClose,
}: {
  message: string | null
  /** error=赤（失敗・入力不足）／ok=緑（できた）／info=青（案内） */
  kind?: 'error' | 'ok' | 'info'
  onClose: () => void
}) {
  useEffect(() => {
    if (!message) return
    // 失敗は読む時間が要るので長めに。できた知らせは短くてよい
    const ms = kind === 'error' ? 7000 : 3500
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [message, kind, onClose])

  if (!message) return null

  const tone = kind === 'ok'
    ? { bg: '#ECFDF5', line: '#A7F3D0', ink: '#166534' }
    : kind === 'info'
      ? { bg: '#EFF6FF', line: '#BFDBFE', ink: '#1D4ED8' }
      : { bg: '#FEF2F2', line: '#FECACA', ink: '#B91C1C' }

  return (
    <div
      role='status'
      aria-live='polite'
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        // ヘッダーやダイアログより上に出す
        zIndex: 2100,
        width: 'calc(100% - 24px)',
        maxWidth: '520px',
        background: tone.bg,
        border: '1.5px solid ' + tone.line,
        color: tone.ink,
        borderRadius: '12px',
        padding: '12px 44px 12px 16px',
        fontSize: '13.5px',
        lineHeight: 1.7,
        fontWeight: 600,
        whiteSpace: 'pre-wrap',
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
      }}
    >
      {message}
      <button
        type='button'
        onClick={onClose}
        aria-label='閉じる'
        style={{
          position: 'absolute', top: '6px', right: '6px',
          width: '32px', height: '32px',
          border: 'none', background: 'transparent', color: tone.ink,
          fontSize: '18px', lineHeight: 1, cursor: 'pointer', borderRadius: '8px',
        }}
      >
        ×
      </button>
    </div>
  )
}
