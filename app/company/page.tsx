'use client'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import Link from 'next/link'

export default function CompanyPage() {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: '会社名', value: '株式会社nav' },
    { label: '設立', value: '2023年11月' },
    { label: '代表取締役', value: '山根 拓也' },
    { label: '所在地', value: '〒136-0073 東京都江東区北砂5-1-26' },
    { label: '事業内容', value: '地域活性事業、遊休地活性事業、イベント活性事業、移動販売活性事業' },
    { label: 'お問い合わせ', value: (
      <span>
        メール: <a href="mailto:info@connect-navi.com" style={{ color: '#E8820C', textDecoration: 'none', fontWeight: 700 }}>info@connect-navi.com</a>
        <br />
        LINE: <a href="https://lin.ee/RjwxqXf" target="_blank" rel="noopener noreferrer" style={{ color: '#E8820C', textDecoration: 'none', fontWeight: 700 }}>LINEで問い合わせる</a>
      </span>
    ) },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SiteHeader />

      <div style={{ background: 'linear-gradient(135deg, #F5A623, #E8820C)', padding: '48px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>会社概要</h1>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95 }}>出店コネクトナビの運営会社情報</p>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'flex', flexWrap: 'wrap', borderBottom: i === rows.length - 1 ? 'none' : '1px solid #F0E6D2', padding: '20px 24px' }}>
              <div style={{ width: '140px', minWidth: '140px', fontSize: '14px', fontWeight: 700, color: '#92400E' }}>{r.label}</div>
              <div style={{ flex: 1, minWidth: '200px', fontSize: '15px', color: '#1a1a1a', lineHeight: 1.7 }}>{r.value}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link href="/" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: '10px', background: '#F5A623', color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>トップへ戻る</Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
