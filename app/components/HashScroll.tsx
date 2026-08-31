'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// 「実績紹介」「よくある質問」のような、ページ内の場所を指すリンクで
// 確実にその場所へ移動させる。
//
// ブラウザは読み込みの途中で1度だけ移動先へスクロールするが、そのあと
// 写真が読み込まれてページの高さが変わると、移動先がずれてしまう。
// アプリ内ブラウザ（Instagram など）で特に起きやすい。
//
// そこで、しばらくのあいだ位置を合わせ直す。
// ただし利用者が自分でスクロールしたら、その時点でやめる。

export default function HashScroll() {
  const pathname = usePathname()

  useEffect(() => {
    let timer = 0
    let stopped = false

    const stop = () => { stopped = true }
    const opts = { passive: true } as const
    window.addEventListener('wheel', stop, opts)
    window.addEventListener('touchmove', stop, opts)
    window.addEventListener('keydown', stop, opts)

    const run = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      stopped = false
      let tries = 0
      const step = () => {
        if (stopped) return
        const el = document.getElementById(id)
        if (el) el.scrollIntoView()
        // 写真の読み込みが落ち着くまで、少しの間くり返す
        if (++tries < 8) timer = window.setTimeout(step, 250)
      }
      clearTimeout(timer)
      step()
    }

    run()
    // 同じページ内で別の場所へのリンクを押したとき
    window.addEventListener('hashchange', run)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('hashchange', run)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchmove', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [pathname])

  return null
}
