'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'ホーム',        href: '/' },
  { label: '出店したい',    href: '/space' },
  { label: 'お店を呼びたい',href: '/vendor' },
  { label: '出店者を探す',  href: '/search/vendors' },
  { label: '出店場所を探す',href: '/search/spaces' },
  { label: '制作・中古販売',href: '/make' },
  { label: '車両を売りたい',href: '/sell' },
]

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <button onClick={() => setOpen(v => !v)} aria-label="メニュー" className="hamburger-btn"
        style={{ display:'none', alignItems:'center', justifyContent:'center', width:'40px', height:'40px', borderRadius:'8px', border:'none', background: open ? '#E08A00' : '#F5A623', cursor:'pointer', flexShrink:0, position:'relative', zIndex:1001 }}>
        <span style={{ display:'block', width:'20px', height:'2px', background:'#fff', borderRadius:'2px', position:'absolute', transition:'transform .3s', transform: open ? 'rotate(45deg)' : 'translateY(-6px)' }} />
        <span style={{ display:'block', width:'20px', height:'2px', background:'#fff', borderRadius:'2px', position:'absolute', transition:'opacity .2s', opacity: open ? 0 : 1 }} />
        <span style={{ display:'block', width:'20px', height:'2px', background:'#fff', borderRadius:'2px', position:'absolute', transition:'transform .3s', transform: open ? 'rotate(-45deg)' : 'translateY(6px)' }} />
      </button>

      {open && <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }} />}

      <nav style={{ position:'fixed', top:0, right:0, height:'100dvh', width:'280px', background:'#fff', zIndex:1000, display:'flex', flexDirection:'column', transform: open ? 'translateX(0)' : 'translateX(100%)', transition:'transform .3s cubic-bezier(.4,0,.2,1)', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)' }}>
        <div style={{ background:'#F5A623', padding:'20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Link href="/" onClick={() => setOpen(false)} style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ background:'#fff', color:'#F5A623', fontWeight:900, fontSize:'13px', padding:'3px 8px', borderRadius:'4px' }}>出店</span>
            <span style={{ color:'#fff', fontWeight:900, fontSize:'16px' }}>コネクトナビ</span>
          </Link>
          <button onClick={() => setOpen(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'6px', width:'32px', height:'32px', cursor:'pointer', color:'#fff', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        <ul style={{ listStyle:'none', padding:'12px 0', margin:0, flex:1, overflowY:'auto' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} style={{ display:'flex', alignItems:'center', padding:'14px 20px', textDecoration:'none', fontWeight: isActive ? 700 : 500, fontSize:'15px', color: isActive ? '#E08A00' : '#333', background: isActive ? '#FFF8E1' : 'transparent', borderLeft: isActive ? '3px solid #F5A623' : '3px solid transparent' }}>
                  {item.label}
                  {isActive && <span style={{ marginLeft:'auto', width:'6px', height:'6px', borderRadius:'50%', background:'#F5A623' }} />}
                </Link>
              </li>
            )
          })}
        </ul>

        <div style={{ padding:'16px 20px', borderTop:'1px solid #F0F0F0', display:'flex', flexDirection:'column', gap:'10px' }}>
          <Link href="/login" onClick={() => setOpen(false)} style={{ display:'block', textAlign:'center', padding:'12px', borderRadius:'8px', border:'1.5px solid #F5A623', color:'#E08A00', fontWeight:700, fontSize:'14px', textDecoration:'none' }}>ログイン</Link>
          <Link href="/register" onClick={() => setOpen(false)} style={{ display:'block', textAlign:'center', padding:'12px', borderRadius:'8px', background:'#F5A623', color:'#fff', fontWeight:700, fontSize:'14px', textDecoration:'none' }}>無料会員登録</Link>
        </div>
      </nav>

      <style>{`
        @media (max-width: 768px) { .hamburger-btn { display: flex !important; } }
      `}</style>
    </>
  )
}
