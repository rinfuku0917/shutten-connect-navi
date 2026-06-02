'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

export default function SpacePage() {
  const merits = [
    {icon:'📍',title:'好立地の場所を簡単発見',desc:'駅前・商業施設・イベントスペースなど多数掲載'},
    {icon:'💰',title:'費用を比較して選べる',desc:'日額・月額・売上歩合など多様なプランを比較'},
    {icon:'🤝',title:'安心のマッチング',desc:'実績・口コミ付きの信頼できる場所オーナーと繋がれる'},
    {icon:'📱',title:'スマホで完結',desc:'申込から契約まで全てオンラインで完結します'},
  ]

  return (
    <div>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-top.png) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'300px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:'100%'}}>
        <h1 style={{color:'#fff',textShadow:'0 2px 8px rgba(0,0,0,0.5)',fontSize:'clamp(26px,4vw,44px)',fontWeight:'900',marginBottom:'12px'}}>出店したい方へ</h1>
        <p style={{color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.5)',fontSize:'16px',marginBottom:'32px'}}>全国の出店スペースを検索して、理想の場所を見つけよう</p>
        <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
          <Link href='/places' style={{background:'#fff',color:'#111',fontWeight:'900',fontSize:'16px',padding:'14px 36px',borderRadius:'999px',whiteSpace:'nowrap',textDecoration:'none',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>出店場所を探す</Link>
          <Link href='/register' style={{background:'rgba(255,255,255,0.2)',color:'#111',fontWeight:'900',fontSize:'16px',border:'2px solid #fff',padding:'14px 36px',borderRadius:'999px',whiteSpace:'nowrap',textDecoration:'none'}}>無料会員登録</Link>
        </div>
      </div>
      <div style={{background:'#fff',padding:'48px 24px',textAlign:'center'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',marginBottom:'32px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>出店コネクトナビのメリット</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',maxWidth:'960px',margin:'0 auto',textAlign:'center'}}>
            {merits.map(m => (
              <div key={m.title} style={{background:'#fff',borderRadius:'12px',border:'1px solid #FFE0A0',padding:'24px',textAlign:'center'}}>
                <div style={{fontSize:'36px',marginBottom:'10px'}}>{m.icon}</div>
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px',color:'#1a1a1a'}}>{m.title}</div>
                <div style={{fontSize:'12px',color:'#111',lineHeight:1.7}}>{m.desc}</div>
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
