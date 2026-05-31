'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
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

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <nav style={{background:'#fff',borderBottom:'3px solid #F5A623',padding:'0 16px',height:'60px',display:'flex',alignItems:'center',justifyContent:'flex-end',position:'sticky',top:0,zIndex:100,boxSizing:'border-box',width:'100%'}}>
        
        <div style={{display:'flex',gap:'4px',alignItems:'center',flexWrap:'nowrap'}} className="pc-nav">
          {navItems.slice(1).map(item => (
            <Link key={item.href} href={item.href} style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:pathname===item.href?'#F5A623':'#222',whiteSpace:'nowrap',padding:'4px 8px',borderRadius:'4px',background:pathname===item.href?'#FFF8E7':'transparent'}}>{item.label}</Link>
          ))}
          <Link href='/login' style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:'#222',border:'1px solid #999',padding:'5px 10px',borderRadius:'6px',whiteSpace:'nowrap',marginLeft:'4px'}}>ログイン</Link>
          <Link href='/register' style={{textDecoration:'none',fontSize:'13px',fontWeight:'700',color:'#fff',background:'#F5A623',padding:'5px 10px',borderRadius:'6px',whiteSpace:'nowrap'}}>会員登録(無料)</Link>
        </div>
        <button onClick={() => setOpen(v => !v)} style={{display:'flex',alignItems:'center',justifyContent:'center',width:'40px',height:'40px',borderRadius:'8px',border:'none',background:open?'#FFF3E0':'transparent',cursor:'pointer',flexShrink:0,order:-1,marginRight:'auto'}} className="ham-btn" aria-label="メニュー">
          <span style={{display:'block',width:'20px',height:'2px',background:'#1a1a1a',borderRadius:'2px',transition:'all .3s',transform:open?'rotate(45deg) translate(5px,5px)':'none'}}/>
          <span style={{display:'block',width:'20px',height:'2px',background:'#1a1a1a',borderRadius:'2px',margin:'4px 0',transition:'all .3s',opacity:open?0:1}}/>
          <span style={{display:'block',width:'20px',height:'2px',background:'#1a1a1a',borderRadius:'2px',transition:'all .3s',transform:open?'rotate(-45deg) translate(5px,-5px)':'none'}}/>
        </button>
      </nav>
      {open && (
        <div style={{position:'fixed',top:'63px',left:0,right:0,bottom:0,background:'#fff',zIndex:99,overflowY:'auto',padding:'16px',boxSizing:'border-box'}}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{display:'block',padding:'16px',fontSize:'16px',fontWeight:'700',color:pathname===item.href?'#F5A623':'#1a1a1a',textDecoration:'none',borderBottom:'1px solid #f0f0f0'}}>{item.label}</Link>
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
        * { box-sizing: border-box; }
        body { max-width: 100vw; overflow-x: hidden; }
      `}</style>
    </>
  )
}
