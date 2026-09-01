import { OG_DEFAULT_IMAGE } from '../lib/seo'
import type { Metadata } from 'next'

// page.tsx がクライアント側の部品（'use client'）なので、
// メタデータはこの layout に置く。
// これが無いと layout.tsx（ルート）の既定をそのまま継承し、
// タイトルも canonical もトップページと同じものになってしまう。

export const metadata: Metadata = {
  title: { absolute: 'お問い合わせ - 出店コネクトナビ' },
  description:
    '出店コネクトナビへのお問い合わせはこちらから。キッチンカーの手配・出店場所の掲載・サービスのご利用方法など、出店者の方も募集者の方もお気軽にご相談ください。ご相談は無料です。',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'お問い合わせ｜出店コネクトナビ',
    description: 'キッチンカーの手配・出店場所の掲載など、お気軽にご相談ください。',
    url: '/contact',
    type: 'website',
    images: [OG_DEFAULT_IMAGE],
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
