'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'ホーム', href: '/' },
  { label: '出店したい', href: '/space' },
  { label: 'お店を呼びたい', href: '/vendor' },
  { label: '出店者を探す', href: '/sellers' },
  { label: '出店場所を探す', href: '/places' },
  { label: '車両を売りたい', href: '/sell' },
  { label: 'ブログ', href: '/blog' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <nav style={{background:'#fff',borderBottom:'3px solid #F5A623',padding:'0 16px',height:'90px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100,boxSizing:'border-box',width:'100%'}}>
        <Link href='/' style={{display:'flex',alignItems:'center',textDecoration:'none',flexShrink:0}}>
          <img src='/logo.png' alt='出店コネクトナビ' className='logo-img' style={{height:'120px',width:'auto',maxWidth:'480px',objectFit:'contain'}} />
        </Link>
        <div style={{display:'flex',gap:'4px',alignItems:'center',flexWrap:'nowrap'}} className="pc-nav">
          {navItems.slice(1).map(item => (
            <Link key={item.href} href={item.href} style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:pathname===item.href?'#F5A623':'#222',whiteSpace:'nowrap',padding:'4px 8px',borderRadius:'4px',background:pathname===item.href?'#FFF8F0':'transparent'}}>{item.label}</Link>
          ))}
          <Link href='/login' style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:'#222',border:'1px solid #999',padding:'5px 10px',borderRadius:'6px',whiteSpace:'nowrap',marginLeft:'4px'}}>ログイン</Link>
          <Link href='/register' style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:'#fff',background:'#F5A623',padding:'5px 10px',borderRadius:'6px',whiteSpace:'nowrap'}}>会員登録(無料)</Link>
        </div>
        <button onClick={() => setOpen(v => !v)} className="ham-btn" aria-label="メニュー" style={{alignItems:'center',justifyContent:'center',flexDirection:'column',width:'44px',height:'44px',borderRadius:'10px',border:'2px solid #F5A623',background:open?'#F5A623':'#fff',cursor:'pointer',flexShrink:0,padding:'8px',gap:'5px'}}>
          <span style={{display:'block',width:'20px',height:'2.5px',background:open?'#fff':'#F5A623',borderRadius:'3px',transition:'all .25s',transform:open?'rotate(45deg) translate(4px,4px)':'none'}}/>
          <span style={{display:'block',width:'20px',height:'2.5px',background:open?'#fff':'#F5A623',borderRadius:'3px',transition:'all .25s',opacity:open?0:1}}/>
          <span style={{display:'block',width:'20px',height:'2.5px',background:open?'#fff':'#F5A623',borderRadius:'3px',transition:'all .25s',transform:open?'rotate(-45deg) translate(4px,-4px)':'none'}}/>
        </button>
      </nav>
      <div className="mobile-menu" style={{position:'fixed',top:'63px',left:0,right:0,bottom:0,background:'#fff',zIndex:99,overflowY:'auto',padding:'16px',boxSizing:'border-box',transform:open?'translateY(0)':'translateY(-110%)',transition:'transform .3s ease',pointerEvents:open?'auto':'none'}}>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',padding:'16px',fontSize:'16px',fontWeight:'700',color:pathname===item.href?'#F5A623':'#1a1a1a',textDecoration:'none',borderBottom:'1px solid #f0f0f0'}}>{item.label}</Link>
        ))}
        <div style={{marginTop:'20px',display:'flex',flexDirection:'column',gap:'10px'}}>
          <Link href='/login' style={{display:'block',padding:'14px',textAlign:'center',border:'2px solid #F5A623',borderRadius:'8px',color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>ログイン</Link>
          <Link href='/register' style={{display:'block',padding:'14px',textAlign:'center',background:'#F5A623',borderRadius:'8px',color:'#fff',fontWeight:'700',textDecoration:'none'}}>無料会員登録</Link>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .pc-nav { display: none !important; }
          .logo-img { height: 130px !important; max-width: 90vw !important; }
          .ham-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .ham-btn { display: none !important; }
          .mobile-menu { display: none !important; }
        }
      `}</style>
    </>
  )
}
