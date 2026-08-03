import { Zen_Maru_Gothic, Zen_Kaku_Gothic_New } from 'next/font/google'

// トップページと同じフォント（見出し=丸ゴシック / 本文=角ゴシック）
export const maru = Zen_Maru_Gothic({ weight: ['500', '700', '900'], subsets: ['latin'] })
export const kaku = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700', '900'], subsets: ['latin'] })

// トップページと同じカラーパレット（黄色×ネイビー）
export const C = {
  navy: '#1b3a5c',
  navyDeep: '#14293f',
  gold: '#f5a623',
  goldDeep: '#e08e0b',
  ink: '#2b2b2b',
  cream: '#fff8ec',
  cream2: '#fef2da',
  sky: '#eaf4fb',
  line: '#eee4d4',
  muted: '#7a7267',
  grayBg: '#f7f4ef',
  footerBg: '#e7f2ea',
  footerInk: '#22402f',
  footerLogo: '#173d29',
  footerMuted: '#456254',
}

// 全ページ共通のセクション見出し（左に金色のバー）
export const secTitle: React.CSSProperties = {
  fontSize: 'clamp(22px,3.2vw,29px)',
  fontWeight: 900,
  lineHeight: 1.3,
}
