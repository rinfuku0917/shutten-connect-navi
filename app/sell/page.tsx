'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

export default function SellPage() {
  const features = [
    {icon:'🚗',title:'無料で掲載',desc:'車両の掲載は完全無料です'},
    {icon:'📸',title:'写真で魅力を伝える',desc:'複数枚の写真を掲載できます'},
    {icon:'💬',title:'直接交渉',desc:'買い手と直接メッセージでやり取り'},
    {icon:'✅',title:'安心取引',desc:'本人確認済みユーザーのみ'},
  ]
  return (
    <div>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-sell.png) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'280px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:'900',color:'#fff',marginBottom:'16px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>車両を売りたい方へ</h1>
        <p style={{fontSize:'16px',color:'rgba(255,255,255,0.9)',marginBottom:'32px'}}>キッチンカー・移動販売車を高値で売却しよう</p>
        <Link href='/register' style={{background:'#fff',color:'#111',fontWeight:'900',fontSize:'16px',padding:'14px 40px',borderRadius:'999px',textDecoration:'none',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>無料で車両を掲載する</Link>
      </div>
      <div style={{background:'#fff',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <div style={{textAlign:'center',marginTop:'24px',fontSize:'20px',fontWeight:'900',color:'#111'}}>
            出店コネクトナビではこんなお悩み必要なし！
          </div>
          <div className='grid-auto' style={{gap:'20px',marginTop:'32px'}}>
            {features.map(f => (
              <div key={f.title} style={{background:'#FFF9F0',borderRadius:'12px',border:'1px solid #FFE0A0',padding:'24px',textAlign:'center'}}>
                <div style={{fontSize:'36px',marginBottom:'10px'}}>{f.icon}</div>
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px',color:'#1a1a1a'}}>{f.title}</div>
                <div style={{fontSize:'12px',color:'#111',lineHeight:1.7}}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer style={{background:'#1E2A3B',color:'#111',padding:'24px',textAlign:'center'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',marginBottom:'8px',display:'block',color:'#111',textDecoration:'none'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#111'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
