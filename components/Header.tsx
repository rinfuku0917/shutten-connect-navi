'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navItems = [
  { label: 'ホーム',        href: '/' },
  { label: '出店したい',    href: '/vendor' },
  { label: 'お店を呼びたい',href: '/space' },
  { label: '出店者を探す',  href: '/sellers' },
  { label: '出店場所を探す',href: '/places' },
  { label: '車両を売りたい',href: '/sell' },
]

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        {/* 上段 */}
        <div style={{ background: '#fff', borderBottom: '3px solid #F5A623', padding: '0 16px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* ロゴ */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '13px', padding: '4px 8px', borderRadius: '5px', whiteSpace: 'nowrap' }}>出店</span>
            <span style={{ fontWeight: 900, fontSize: '16px', color: '#1a1a1a', whiteSpace: 'nowrap' }}>コネクト<span style={{ color: '#F5A623' }}>ナビ</span></span>
          </Link>

          {/* デスクトップ：ログイン・会員登録 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="pc-only">
            <Link href="/login" style={{ color: '#555', fontWeight: 700, fontSize: '13px', textDecoration: 'none', padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #ddd', whiteSpace: 'nowrap' }}>ログイン</Link>
            <Link href="/register" style={{ background: '#3A9BD5', color: '#fff', borderRadius: '999px', padding: '6px 14px', fontSize: '13px', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}>会員登録(無料)</Link>
          </div>

          {/* モバイル：ハンバーガーボタン */}
          <button
            onClick={() => setOpen(v => !v)}
            className="sp-only"
            aria-label="メニュー"
            style={{ display: 'none', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '5px', width: '40px', height: '40px', background: '#F5A623', border: 'none', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 }}
          >
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#fff', borderRadius: '2px', transition: 'transform .3s', transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#fff', borderRadius: '2px', transition: 'opacity .2s', opacity: open ? 0 : 1 }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#fff', borderRadius: '2px', transition: 'transform .3s', transform: open ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
          </button>
        </div>

        {/* デスクトップ：オレンジバー */}
        <div className="pc-only" style={{ background: '#F5A623', display: 'flex' }}>
          {navItems.map((item, i, arr) => (
            <Link key={item.href} href={item.href} style={{ flex: 1, color: '#fff', fontWeight: 900, fontSize: '12px', padding: '10px 4px', textDecoration: 'none', textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none', background: pathname === item.href ? 'rgba(0,0,0,0.15)' : 'transparent', whiteSpace: 'nowrap' }}>{item.label}</Link>
          ))}
        </div>
      </header>

      {/* オーバーレイ */}
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />}

      {/* ドロワーメニュー */}
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100dvh', width: '75vw', maxWidth: '300px', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .3s cubic-bezier(.4,0,.2,1)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
        {/* ドロワーヘッダー */}
        <div style={{ background: '#F5A623', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" onClick={() => setOpen(false)} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: '#fff', color: '#F5A623', fontWeight: 900, fontSize: '12px', padding: '3px 7px', borderRadius: '4px' }}>出店</span>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: '15px' }}>コネクトナビ</span>
          </Link>
          <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '6px', width: '30px', height: '30px', cursor: 'pointer', color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* ナビリンク */}
        <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0, flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', textDecoration: 'none', fontWeight: isActive ? 700 : 500, fontSize: '15px', color: isActive ? '#E08A00' : '#333', background: isActive ? '#FFF8E1' : 'transparent', borderLeft: isActive ? '4px solid #F5A623' : '4px solid transparent' }}>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* ログイン・会員登録 */}
        <div style={{ padding: '16px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link href="/login" onClick={() => setOpen(false)} style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: '8px', border: '1.5px solid #F5A623', color: '#E08A00', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>ログイン</Link>
          <Link href="/register" onClick={() => setOpen(false)} style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: '8px', background: '#F5A623', color: '#fff', fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>無料会員登録</Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .pc-only { display: none !important; }
          .sp-only { display: flex !important; }
        }
      `}</style>
    </>
  )
}
