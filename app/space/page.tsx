import Link from 'next/link'

export default function SpacePage() {
  const steps = [
    {num:'01',title:'無料会員登録',desc:'メールアドレスだけで簡単登録。すぐに掲載できます。'},
    {num:'02',title:'場所・日程を登録',desc:'出店してほしい場所・日程・条件を登録するだけ。'},
    {num:'03',title:'応募が届く',desc:'全国の出店者からエントリーが届きます。'},
    {num:'04',title:'承認して完了！',desc:'気に入った出店者を承認すれば確定。簡単です。'},
  ]
  const merits = [
    {icon:'🆓',title:'掲載完全無料',desc:'掲載費用・成約手数料すべて無料。'},
    {icon:'🚚',title:'全国の出店者',desc:'キッチンカー・物販・ワークショップなど多様な出店者が登録。'},
    {icon:'📣',title:'一斉配信機能',desc:'登録出店者に新着案件をメールで一斉通知。'},
    {icon:'💬',title:'チャット機能',desc:'応募者と直接メッセージでやり取り。'},
    {icon:'📅',title:'カレンダー管理',desc:'日程ごとに応募・承認状況を一目で確認。'},
    {icon:'⭐',title:'口コミ・評価',desc:'出店者の実績・評価を事前に確認できる。'},
  ]
  const voices = [
    {name:'渋谷マルシェ 実行委員会',area:'東京',comment:'掲載してすぐに10件以上の応募が届きました！思っていた以上に良い出店者さんと出会えました。'},
    {name:'大阪城公園イベント',area:'大阪',comment:'カレンダー管理がすごく便利で、日程ごとに誰が出店するか一目でわかります。'},
    {name:'福岡天神オフィスビル管理組合',area:'福岡',comment:'ランチ出店を毎週募集しています。継続して良い出店者さんを見つけられています。'},
  ]
  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      <nav style={{background:'#fff',borderBottom:'3px solid #F5A623',padding:'0 24px',height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Link href='/' style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none'}}>
          <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'5px 10px',borderRadius:'5px'}}>出店</span>
          <span style={{fontWeight:'900',fontSize:'18px',color:'#1a1a1a'}}>コネクト<span style={{color:'#F5A623'}}>ナビ</span></span>
        </Link>
        <div style={{display:'flex',gap:'10px'}}>
          <Link href='/login' style={{border:'1px solid #ddd',color:'#555',borderRadius:'999px',padding:'6px 16px',fontSize:'13px',textDecoration:'none'}}>ログイン</Link>
          <Link href='/register' style={{background:'#3A9BD5',color:'#fff',borderRadius:'999px',padding:'7px 18px',fontSize:'13px',fontWeight:'900',textDecoration:'none'}}>会員登録(無料)</Link>
        </div>
      </nav>
      <div style={{background:'#F5A623',display:'flex'}}>
        {[{label:'ホーム',href:'/'},{label:'出店したい',href:'/vendor'},{label:'お店を呼びたい',href:'/space'},{label:'出店者を探す',href:'/sellers'},{label:'出店場所を探す',href:'/places'},{label:'車両を売りたい',href:'/sell'}].map((item,i,arr)=>(
          <Link key={item.label} href={item.href} style={{flex:1,color:'#fff',fontWeight:'900',fontSize:'13px',padding:'12px 0',textAlign:'center',textDecoration:'none',borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.3)':'none',background:item.href==='/space'?'rgba(0,0,0,0.15)':'transparent'}}>
            {item.label}
          </Link>
        ))}
      </div>
      <div style={{background:'linear-gradient(135deg,#FFF4B0,#FFE44D)',padding:'60px 24px',textAlign:'center'}}>
        <div style={{fontSize:'56px',marginBottom:'16px'}}>📣</div>
        <h1 style={{fontSize:'40px',fontWeight:'900',color:'#1a1a1a',marginBottom:'12px'}}>お店を呼びたい方へ</h1>
        <p style={{fontSize:'16px',color:'#555',marginBottom:'28px',lineHeight:1.8}}>イベント・商業施設・大学・オフィスなど<br/>あなたのスペースに最適な出店者を無料で募集できます</p>
        <div style={{display:'flex',gap:'16px',justifyContent:'center'}}>
          <Link href='/register?role=host' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'16px',padding:'14px 36px',borderRadius:'999px',textDecoration:'none',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>無料で募集を始める</Link>
          <Link href='/sellers' style={{background:'#fff',color:'#1D4ED8',fontWeight:'900',fontSize:'16px',border:'3px solid #3A9BD5',padding:'14px 36px',borderRadius:'999px',textDecoration:'none'}}>出店者を探す</Link>
        </div>
      </div>
      <div style={{background:'#fff',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',marginBottom:'36px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>ご利用の流れ</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'20px'}}>
            {steps.map((s,i)=>(
              <div key={s.num} style={{textAlign:'center',position:'relative'}}>
                {i<steps.length-1 && <div style={{position:'absolute',top:'24px',right:'-10px',width:'20px',height:'2px',background:'#F5A623'}}></div>}
                <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>{s.num}</div>
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
                <div style={{fontWeight:'900',fontSize:'15px',marginBottom:'8px'}}>{m.title}</div>
                <div style={{fontSize:'12px',color:'#888',lineHeight:1.7}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:'#fff',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',marginBottom:'32px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>ご利用者の声</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'20px'}}>
            {voices.map(v=>(
              <div key={v.name} style={{background:'#FFF9E6',borderRadius:'12px',border:'1px solid #FFE0A0',padding:'24px'}}>
                <div style={{fontSize:'24px',color:'#F5A623',marginBottom:'10px'}}>★★★★★</div>
                <p style={{fontSize:'13px',color:'#555',lineHeight:1.8,marginBottom:'12px'}}>{v.comment}</p>
                <div style={{fontWeight:'700',fontSize:'13px',color:'#1a1a1a'}}>{v.name}</div>
                <div style={{fontSize:'12px',color:'#888'}}>{v.area}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:'#F5A623',padding:'48px 24px',textAlign:'center'}}>
        <h2 style={{fontSize:'28px',fontWeight:'900',color:'#fff',marginBottom:'12px'}}>今すぐ無料で募集を始めよう！</h2>
        <p style={{color:'rgba(255,255,255,0.9)',marginBottom:'24px',fontSize:'15px'}}>登録無料・掲載無料・成約手数料なし</p>
        <Link href='/register?role=host' style={{background:'#fff',color:'#E08A00',fontWeight:'900',fontSize:'18px',padding:'16px 48px',borderRadius:'999px',textDecoration:'none',boxShadow:'0 4px 15px rgba(0,0,0,0.15)'}}>無料で募集を始める</Link>
      </div>
      <footer style={{background:'#1E2A3B',color:'#fff',padding:'24px',textAlign:'center'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',display:'block',color:'#fff',textDecoration:'none',marginBottom:'8px'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#666'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
