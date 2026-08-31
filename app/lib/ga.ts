import { sendGAEvent } from '@next/third-parties/google'

// Google アナリティクスに「何が起きたか」を送る。
//
// 相談フォームの送信など、成果につながった操作を記録して、
// どのページ経由の相談が多いかを見られるようにするためのもの。
//
// 測定IDを設定していないときは、何もせず静かに終わる。

export function track(event: string, params: Record<string, string | number> = {}) {
  if (typeof window === 'undefined') return
  // GA を読み込んでいなければ何もしない
  if (!(window as unknown as { dataLayer?: unknown[] }).dataLayer) return
  try {
    sendGAEvent('event', event, params)
  } catch {
    // 計測が失敗しても、画面の動きは止めない
  }
}
