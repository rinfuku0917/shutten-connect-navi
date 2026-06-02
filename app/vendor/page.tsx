'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

export default function VendorPage() {
  const steps = [
    {num:'01',title:'無料登録',desc:'メールアドレスだけで簡単登録'},
    {num:'02',title:'プロフィール作成',desc:'お店の情報・写真を登録しよう'},
    {num:'03',title:'場所を探す',desc:'条件に合う出店スペースを検索'},
    {num:'04',title:'申込・契約',desc:'オーナーと連絡してオンラインで完結'},
  ]

  return (
    <div>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.35)),url(/hero-bg.png) center/cover no-repeat',padding:'64px 24px',textAlign:'center'}}>
        <h1 style={{fontSize:'32px',fontWeight:'900',color:'#fff',textShadow:'0 2px 8px rgba(0,0,0,0.5)',marginBottom:'16px'}}>お店を呼びたい方へ</h1>
        <p style={{fontSize:'16px',color:'rgba(255,255,255,0.9)',marginBottom:'32px'}}>あなたのスペースに最適な出店者を見つけよう</p>
        <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
          <Link href='/sellers' style={{background:'#fff',color:'#111',fontWeight:'900',fontSize:'16px',padding:'14px 36px',borderRadius:'999px',textDecoration:'none',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>出店者を探す</Link>
          <Link href='/register' style={{background:'#0EA5E9',color:'#111',fontWeight:'900',fontSize:'16px',border:'#0EA5E9',padding:'14px 36px',borderRadius:'999px',textDecoration:'none'}}>無料会員登録</Link>
        </div>
      </div>
      <div style={{background:'#fff',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',textAlign:'center',marginBottom:'36px',color:'#111'}}>ご利用の流れ</h2>
          <div className='grid-4' style={{gap:'20px',maxWidth:'900px',margin:'0 auto',textAlign:'center'}}>
            {steps.map((s,i) => (
              <div key={s.num} style={{textAlign:'center',position:'relative',padding:'16px 8px'}}>
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px',color:'#111',textAlign:'center'}}>{s.title}</div>
                <div style={{fontSize:'12px',color:'#111',lineHeight:1.7}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer style={{background:'#F5A623',color:'#111',padding:'24px',textAlign:'center'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',marginBottom:'8px',display:'block',color:'#111',textDecoration:'none'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#111'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
