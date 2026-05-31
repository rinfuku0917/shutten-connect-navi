import Link from 'next/link'
import Nav from '../components/Nav'

export default function SellPage() {
  const worries = [
    '車の買取店に売却しようとしたら、思ったよりも安かった',
    '古くて誰も買い取ってくれないだろうな…',
    '車の売却査定のフォームを入力後、営業マンから引っ切りなしに電話がかかってきた',
    'キッチンカーの売却先が見つからない',
  ]
  const merits = [
    {icon:'💰',title:'高額売却',desc:'キッチンカー専門のバイヤーに直接売却。相場より高く売れる可能性大。'},
    {icon:'📵',title:'営業電話なし',desc:'しつこい営業電話一切なし。掲載するだけで買い手から連絡が来ます。'},
    {icon:'🆓',title:'掲載無料',desc:'掲載費用・成約手数料すべて無料。売れた時だけの完全成果報酬。'},
    {icon:'🚚',title:'専門知識',desc:'キッチンカー・移動販売車に特化。専門家が適正価格をアドバイス。'},
    {icon:'⚡',title:'スピード成約',desc:'全国の購入希望者に一斉公開。最短即日で問い合わせが届きます。'},
    {icon:'🔒',title:'安心取引',desc:'本人確認済みの登録者のみ。安全に取引できる環境を提供。'},
  ]
  const faqs = [
    {q:'どんな車両でも売れますか？',a:'キッチンカー・移動販売車・フードトラックなど幅広く対応しています。古い車両や改造車両もお気軽にご相談ください。'},
    {q:'掲載から成約まで平均どのくらいかかりますか？',a:'車両の状態や価格設定によりますが、平均2〜4週間で成約しています。人気の車両は即日問い合わせが来ることもあります。'},
    {q:'写真は何枚まで掲載できますか？',a:'最大20枚まで掲載可能です。外観・内装・設備など詳しく掲載するほど問い合わせが増えます。'},
    {q:'価格交渉はできますか？',a:'はい、売主と買主の直接交渉が可能です。希望価格を設定した上で、問い合わせ後に交渉することができます。'},
    {q:'成約後のサポートはありますか？',a:'名義変更・車検証の手続きなど、成約後の手続きについてもサポートいたします。'},
  ]
  return (
    <>
      <Nav />
      <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      
      
      <div style={{background:'linear-gradient(135deg,#FFF4B0,#FFE44D)',padding:'60px 24px',textAlign:'center'}}>
        <div style={{fontSize:'clamp(30px, 7vw, 56px)',marginBottom:'16px'}}>🚐</div>
        <h1 style={{fontSize:'40px',fontWeight:'900',color:'#1a1a1a',marginBottom:'12px'}}>車両を売りたい方へ</h1>
        <p style={{fontSize:'16px',color:'#555',marginBottom:'28px',lineHeight:1.8}}>キッチンカー・移動販売車の売却なら<br/>出店コネクトナビにお任せください</p>
        <Link href='/register' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'16px',padding:'14px 40px',borderRadius:'999px',textDecoration:'none',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>無料で車両を掲載する</Link>
      </div>
      <div style={{background:'#fff',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          
              ))}
            </div>
            <div style={{textAlign:'center',marginTop:'24px',fontSize:'20px',fontWeight:'900',color:'#B45309'}}>
              出店コネクトナビではこんなお悩み必要なし！
            </div>
          </div>
        </div>
      </div>
      <div style={{background:'#FFF9E6',padding:'48px 24px'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <h2 style={{fontSize:'26px',fontWeight:'900',marginBottom:'32px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>出店コネクトナビで売るメリット</h2>
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
          <h2 style={{fontSize:'26px',fontWeight:'900',marginBottom:'32px',borderLeft:'5px solid #F5A623',paddingLeft:'12px'}}>よくある質問</h2>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {faqs.map((f,i)=>(
              <div key={i} style={{border:'1px solid #E5E7EB',borderRadius:'12px',overflow:'hidden'}}>
                <div style={{background:'#FFFBEB',padding:'16px 20px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
                  <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'13px',padding:'2px 10px',borderRadius:'999px',flexShrink:0}}>Q</span>
                  <span style={{fontWeight:'700',fontSize:'14px'}}>{f.q}</span>
                </div>
                <div style={{padding:'16px 20px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
                  <span style={{background:'#3A9BD5',color:'#fff',fontWeight:'900',fontSize:'13px',padding:'2px 10px',borderRadius:'999px',flexShrink:0}}>A</span>
                  <span style={{fontSize:'13px',color:'#555',lineHeight:1.8}}>{f.a}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <footer style={{background:'#1E2A3B',color:'#fff',padding:'24px',textAlign:'center'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',display:'block',color:'#fff',textDecoration:'none',marginBottom:'8px'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#666'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
