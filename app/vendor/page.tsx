import Link from 'next/link'

export default function VendorPage() {
  const steps = [
    {num:'01',title:'無料会員登録',desc:'メールアドレスだけで簡単登録。審査不要でスグ使えます。'},
    {num:'02',title:'出店場所を探す',desc:'エリア・ジャンル・料金で絞り込み。気になる案件を見つけよう。'},
    {num:'03',title:'エントリーする',desc:'気になる案件にワンクリックでエントリー。主催者に届きます。'},
    {num:'04',title:'承認・出店！',desc:'主催者から承認が届いたら出店確定。当日を楽しみに！'},
  ]
  const merits = [
    {icon:'🆓',title:'完全無料',desc:'登録・掲載・マッチングすべて無料。手数料一切なし。'},
    {icon:'📍',title:'全国対応',desc:'北海道から沖縄まで全国の出店場所を掲載。'},
    {icon:'📅',title:'日程管理',desc:'カレンダーで出店予定を一元管理。'},
    {icon:'💬',title:'チャット機能',desc:'主催者と直接メッセージでやり取り可能。'},
    {icon:'⭐',title:'口コミ・評価',desc:'実際の出店者の口コミで安心して選べる。'},
    {icon:'📋',title:'書類管理',desc:'許可証・保険証など必要書類をまとめて管理。'},
  ]
  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      
      
      <div style={{background:'linear-gradient(135deg,#FFF4B0,#FFE44D)',padding:'60px 24px',textAlign:'center'}}>
        <div style={{fontSize:'56px',marginBottom:'16px'}}>🚚</div>
        <h1 style={{fontSize:'40px',fontWeight:'900',color:'#1a1a1a',marginBottom:'12px'}}>出店したい方へ</h1>
        <p style={{fontSize:'16px',color:'#555',marginBottom:'28px',lineHeight:1.8}}>全国のイベント・商業施設・大学・オフィスなど<br/>あなたにぴったりの出店場所が見つかります</p>
        <div style={{display:'flex',gap:'16px',justifyContent:'center'}}>
          <Link href='/places' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'16px',padding:'14px 36px',borderRadius:'999px',textDecoration:'none',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>出店場所を探す</Link>
          <Link href='/register' style={{background:'#fff',color:'#1D4ED8',fontWeight:'900',fontSize:'16px',border:'3px solid #3A9BD5',padding:'14px 36px',borderRadius:'999px',textDecoration:'none'}}>無料会員登録</Link>
        </div>
      </div>
      <div style={{background:'#fff',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',textAlign:'center',marginBottom:'36px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>ご利用の流れ</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'20px'}}>
            {steps.map((s,i)=>(
              <div key={s.num} style={{textAlign:'center',position:'relative'}}>
                {i<steps.length-1 && }
                
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px'}}>{s.title}</div>
                <div style={{fontSize:'12px',color:'#888',lineHeight:1.7}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:'#FFF9E6',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',marginBottom:'32px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>出店コネクトナビのメリット</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'20px'}}>
            {merits.map(m=>(
              <div key={m.title} style={{background:'#fff',borderRadius:'12px',border:'1px solid #FFE0A0',padding:'24px',textAlign:'center'}}>
                <div style={{fontSize:'36px',marginBottom:'10px'}}>{m.icon}</div>
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px',color:'#1a1a1a'}}>{m.title}</div>
                <div style={{fontSize:'12px',color:'#888',lineHeight:1.7}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <footer style={{background:'#1E2A3B',color:'#fff',padding:'24px',textAlign:'center'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',marginBottom:'8px',display:'block',color:'#fff',textDecoration:'none'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#666'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
