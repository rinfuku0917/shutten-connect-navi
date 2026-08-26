'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

// 前の画面に戻るボタン。
// 案件やブログを開いたあと元の画面に戻れず、ログインし直すことになっていたため、
// 主要なページの上部に置いている。
// 直前の履歴が無い場合（直接URLを開いた・別タブで開いた）は、
// 代わりに指定した行き先へ移動する。

export default function BackButton({
  fallback = '/',
  label = '戻る',
}: {
  fallback?: string
  label?: string
}) {
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(true)

  useEffect(() => {
    // 履歴が無いときは戻れないので、行き先を切り替える
    if (typeof window !== 'undefined') setCanGoBack(window.history.length > 1)
  }, [])

  return (
    <button
      onClick={() => { if (canGoBack) router.back(); else router.push(fallback) }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '999px',
        padding: '8px 18px', fontSize: '13px', fontWeight: 700, color: '#475569',
        cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <span style={{ fontSize: '15px', lineHeight: 1 }}>←</span>
      {label}
    </button>
  )
}
