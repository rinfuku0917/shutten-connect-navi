'use client'
import { useEffect, useRef, useState } from 'react'

// 数字が 0 から目標値まで数え上がる表示。
//
// 画面をスクロールしてその数字が見えたときに1回だけ動く。
// 見えていないうちから動かすと、たどり着いたときには終わってしまうため。
//
// 最初は完成した数字を出しておき、動かせると分かってから 0 に戻して数え上げる。
// こうしておかないと、JavaScript が動かない環境や検索エンジンから見たときに
// 「0」と表示されてしまう。
//
// 「動きを減らす」設定にしている端末では、動かさず完成値のまま出す。

type Props = {
  value: number
  /** 数字のうしろに付ける文字（例: '+' や '店'） */
  suffix?: string
  /** 数え上がりにかける時間（ミリ秒） */
  duration?: number
  className?: string
  style?: React.CSSProperties
}

// 最初は速く、終わりに向かってゆっくり止まる動き
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function CountUp({ value, suffix = '', duration = 1600, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  // 完成値から始める（動かせると分かった時点で 0 に戻す）
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') return

    let raf = 0
    let started = false
    let fallback = 0

    const run = () => {
      if (started) return
      started = true
      clearTimeout(fallback)
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        setShown(Math.round(value * easeOut(t)))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    setShown(0)

    const io = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          io.disconnect()
          run()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)

    // 監視が働かない状況（タブが裏にあるなど）でも「0」のまま残さない
    fallback = window.setTimeout(() => {
      if (!started) {
        started = true
        io.disconnect()
        setShown(value)
      }
    }, 4000)

    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(fallback)
    }
  }, [value, duration])

  return (
    <span ref={ref} className={className} style={style}>
      {shown.toLocaleString('ja-JP')}
      {suffix}
    </span>
  )
}
