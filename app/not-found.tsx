import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'

// 見つからないURLに来たときの画面。
// これまでは Next.js の英語の初期画面が出ていて、そこから
// サイト内に戻る手段が無かった。

export const metadata: Metadata = {
  title: 'ページが見つかりません',
  robots: { index: false, follow: true },
}

const LINKS = [
  { href: '/', label: 'トップページ' },
  { href: '/places', label: '出店場所を探す' },
  { href: '/sellers', label: '出店者を探す' },
  { href: '/vendor', label: 'キッチンカーを呼びたい方へ' },
  { href: '/space', label: '出店したい方へ' },
  { href: '/contact', label: 'お問い合わせ' },
]

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />
      <div style={{ flex: 1, background: '#FFF9E6', padding: '64px 24px' }}>
        <div style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😢</div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#111', marginBottom: '12px' }}>
            お探しのページが見つかりませんでした
          </h1>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.9, marginBottom: '28px' }}>
            URLが変わったか、募集が終了した可能性があります。
            <br />
            下のリンクからお探しください。
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '999px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, color: '#111', textDecoration: 'none' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
