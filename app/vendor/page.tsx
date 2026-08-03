'use client'
import Link from 'next/link'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

export default function VendorPage() {
  const steps = [
    {num:'01',title:'簡単・無料登録',desc:'メールアドレス等の入力だけで完了。初期費用や登録料は一切かかりません。'},
    {num:'02',title:'スペース・イベント情報の登録',desc:'活用したい空きスペースの概要や、開催予定のイベント情報を登録します。'},
    {num:'03',title:'条件調整・専任サポート',desc:'専任の営業担当がご要望を伺い、最適な条件設定から理想の実現まで一緒に伴走します。'},
    {num:'04',title:'募集〜マッチング・契約まで一括完結',desc:'出店者の募集から契約、当日のマッチングまで弊社が一括サポート。安心しておまかせいただけます。'},
  ]

  return (
    <div>
      <SiteHeader />
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
              <div key={s.num} style={{textAlign:'center',padding:'16px 8px',display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'12px'}}>{i+1}</div>
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px',color:'#111',textAlign:'center'}}>{s.title}</div>
                <div style={{fontSize:'12px',color:'#111',lineHeight:1.7}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
