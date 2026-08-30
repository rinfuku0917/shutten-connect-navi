import type { Metadata } from 'next'

// 会員・管理者だけが使う画面なので、検索結果には出さない。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
