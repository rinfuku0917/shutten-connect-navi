'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { C } from './siteTheme'

// トップページと同じ見た目のヘッダー。全公開ページで共有する。
const menuItems: { href: string; label: string }[] = [
  { href: '/space', label: '出店したい方へ' },
  { href: '/vendor', label: 'お店を呼びたい方へ' },
  { href: '/places', label: '出店場所を探す' },
  { href: '/sellers', label: '出店者を探す' },
  { href: '/sell', label: '車両を売りたい' },
  { href: '/blog', label: 'ブログ' },
  { href: '/company', label: '運営会社' },
  { href: '/contact', label: 'お問い合わせ' },
]

const navLinks = menuItems.slice(0, 4)

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
        setRole(prof?.role ?? null)
      } else { setRole(null) }
      setAuthChecked(true)
    })()
  }, [pathname])

  const myPage = role === 'host' ? '/dashboard/host' : '/dashboard/seller'
  const linkStyle: React.CSSProperties = { color: C.ink, textDecoration: 'none', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid ' + C.line }}>
      <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', height: '64px' }}>
        <Link href='/' style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <img src='/logo.svg' alt='出店コネクトナビ' style={{ height: '34px', width: 'auto', display: 'block' }} />
        </Link>
        <nav className='top3-gnav' style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0 }}>
          {navLinks.map(m => (
            <Link key={m.href} href={m.href} style={{ ...linkStyle, color: pathname === m.href ? C.goldDeep : C.ink }}>{m.label}</Link>
          ))}
          {authChecked && role
            ? <Link href={myPage} className='top3-login' style={{ ...linkStyle, border: '1.5px solid ' + C.line, padding: '8px 16px', borderRadius: '8px' }}>マイページ</Link>
            : <Link href='/login' className='top3-login' style={{ ...linkStyle, border: '1.5px solid ' + C.line, padding: '8px 16px', borderRadius: '8px' }}>ログイン</Link>}
          <Link href='/contact' className='top3-contact' style={{ background: C.navy, color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap', padding: '9px 18px', borderRadius: '8px' }}>お問い合わせ</Link>
          <button onClick={() => setMenuOpen(v => !v)} aria-label='メニュー' aria-expanded={menuOpen} className='top3-burger' style={{ background: '#fff', border: '1.5px solid ' + C.line, borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', alignItems: 'center', gap: '7px', color: C.ink, fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
            <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ width: '18px', height: '2px', background: C.ink, borderRadius: '2px' }} />
              <span style={{ width: '18px', height: '2px', background: C.ink, borderRadius: '2px' }} />
              <span style={{ width: '18px', height: '2px', background: C.ink, borderRadius: '2px' }} />
            </span>
            メニュー
          </button>
        </nav>
      </div>
      {menuOpen && (
        <div style={{ borderTop: '1px solid ' + C.line, background: '#fff', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '10px 20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '4px 16px' }}>
            <Link href='/' onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 6px', color: C.ink, textDecoration: 'none', fontSize: '14px', fontWeight: 700, borderBottom: '1px solid ' + C.line }}>トップ</Link>
            {menuItems.map(m => (
              <Link key={m.href} href={m.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 6px', color: C.ink, textDecoration: 'none', fontSize: '14px', fontWeight: 700, borderBottom: '1px solid ' + C.line }}>{m.label}</Link>
            ))}
            {authChecked && role
              ? <Link href={myPage} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 6px', color: C.goldDeep, textDecoration: 'none', fontSize: '14px', fontWeight: 700, borderBottom: '1px solid ' + C.line }}>マイページ</Link>
              : <Link href='/register' onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 6px', color: C.goldDeep, textDecoration: 'none', fontSize: '14px', fontWeight: 700, borderBottom: '1px solid ' + C.line }}>無料で会員登録</Link>}
          </div>
        </div>
      )}
    </div>
  )
}
