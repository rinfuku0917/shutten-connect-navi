'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'ホーム', href: '/' },
  { label: '出店したい', href: '/vendor' },
  { label: 'お店を呼びたい', href: '/space' },
  { label: '出店者を探す', href: '/sellers' },
  { label: '出店場所を探す', href: '/places' },
  { label: '車両を売りたい', href: '/sell' },
  { label: 'ブログ', href: '/blog' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <nav style={{background:'#fff',borderBottom:'3px solid #F5A623',padding:'0 24px',height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <Link href='/' style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none'}}>
          <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'5px 10px',borderRadius:'5px'}}>出店</span>
          <span style={{fontWeight:'900',fontSize:'16px',color:'#1a1a1a'}}>コネクト<span style={{color:'#F5A623'}}>ナビ</span></span>
        </Link>
        <div style={{display:'flex',gap:'16px',alignItems:'center'}} className="pc-nav">
          {navItems.slice(1).map(item => (
            <Link key={item.href} href={item.href} style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color: pathname===item.href ? '#F5A623' : '#333'}}>{item.label}</Link>
          ))}
          <Link href='/login' style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:'#333',border:'1px solid #ddd',padding:'6px 12px',borderRadius:'6px'}}>ログイン</Link>
          <Link href='/register' style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:'#fff',background:'#F5A623',padding:'6px 12px',borderRadius:'6px'}}>会員登録(無料)</Link>
        </div>
        <button onClick={() => setOpen(v => !v)} style={{display:'none',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:'5px',width:'40px',height:'40px',background:'none',border:'none',cursor:'pointer'}} className="ham-btn" aria-label="メニュー">
          <span style={{display:'block',width:'24px',height:'2px',background:'#333',borderRadius:'2px',transition:'all .3s',transform: open ? 'rotate(45deg) translate(5px,5px)' : 'none'}}/>
          <span style={{display:'block',width:'24px',height:'2px',background:'#333',borderRadius:'2px',transition:'all .3s',opacity: open ? 0 : 1}}/>
          <span style={{display:'block',width:'24px',height:'2px',background:'#333',borderRadius:'2px',transition:'all .3s',transform: open ? 'rotate(-45deg) translate(5px,-5px)' : 'none'}}/>
        </button>
      </nav>
      {open && (
        <div style={{position:'fixed',top:'63px',left:0,right:0,bottom:0,background:'#fff',zIndex:99,overflowY:'auto',padding:'16px'}}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{display:'block',padding:'16px',fontSize:'16px',fontWeight:'700',color: pathname===item.href ? '#F5A623' : '#1a1a1a',textDecoration:'none',borderBottom:'1px solid #f0f0f0'}}>
              {item.label}
            </Link>
          ))}
          <div style={{marginTop:'20px',display:'flex',flexDirection:'column',gap:'10px'}}>
            <Link href='/login' style={{display:'block',padding:'14px',textAlign:'center',border:'2px solid #F5A623',borderRadius:'8px',color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>ログイン</Link>
            <Link href='/register' style={{display:'block',padding:'14px',textAlign:'center',background:'#F5A623',borderRadius:'8px',color:'#fff',fontWeight:'700',textDecoration:'none'}}>無料会員登録</Link>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .pc-nav { display: none !important; }
          .ham-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
