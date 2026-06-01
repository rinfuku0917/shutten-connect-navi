'use client'
import Link from 'next/link'
import Nav from './components/Nav'

const places = [
  {id:1,name:'日本体育大学医療専門学校（6〜8月スケジュール）',area:'東京',type:'常設',price:'日額5,000円',time:'11:00〜16:00',tags:['キッチンカー'],emoji:'🏫',isNew:true},
  {id:2,name:'大阪公立大学りんくうキャンパス（7月募集）',area:'大阪',type:'常設',price:'無料',time:'11:00〜14:00',tags:['キッチンカー'],emoji:'🏫',isNew:true},
  {id:3,name:'イオンモール富谷',area:'宮城',type:'常設',price:'要相談',time:'11:00〜17:00',tags:['キッチンカー','物販'],emoji:'🏪'},
  {id:4,name:'町田美容専門学校',area:'東京',type:'常設',price:'日額3,000円',time:'11:30〜13:30',tags:['キッチンカー'],emoji:'🏫'},
  {id:5,name:'福岡天神エリア オフィスビル',area:'福岡',type:'常設',price:'日額4,000円',time:'11:00〜14:00',tags:['キッチンカー'],emoji:'🏢'},
  {id:6,name:'横浜みなとみらい 週末マルシェ',area:'神奈川',type:'イベント',price:'日額5,000円',time:'10:00〜17:00',tags:['テント','物販'],emoji:'🌳'},
]
const vendors = [
  {id:1,name:'たこ焼き大阪屋',genre:'たこ焼き',rating:4.8,emoji:'🐙'},
  {id:2,name:'La France',genre:'クレープ',rating:4.9,emoji:'🥞'},
  {id:3,name:'炭火屋',genre:'焼き鳥',rating:4.7,emoji:'🔨'},
  {id:4,name:'スパイス',genre:'カレー',rating:4.6,emoji:'🍛'},
  {id:5,name:'BREW',genre:'コーヒー',rating:4.9,emoji:'☕'},
  {id:6,name:'ソウルキッチン',genre:'韓国料理',rating:4.5,emoji:'🌮'},
]

export default function Home() {
  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      <Nav />
      <div style={{background:'#fff',borderBottom:'1px solid #eee',padding:'8px 16px',overflowX:'auto',whiteSpace:'nowrap'}}>
        {['キッチンカー','テント','常設','イベント','学校・大学','オフィス','商業施設','公園・屋外'].map(c=>(
          <button key={c} style={{display:'inline-block',padding:'6px 14px',margin:'0 4px',borderRadius:'20px',border:'1px solid #ddd',background:'#fff',fontSize:'13px',cursor:'pointer',whiteSpace:'nowrap',color:'#111',fontWeight:'700'}}>{c}</button>
        ))}
      </div>
      <div style={{background:'linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.3)),url(/hero-top.png) center/cover no-repeat',padding:'40px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:'100%',overflow:'hidden'}}>
        <div>
          <h1 style={{fontSize:'clamp(24px,5vw,40px)',fontWeight:'900',color:'#fff',lineHeight:1.3,marginBottom:'12px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>最高の出店場所が<br/>見つかる</h1>
          <p style={{fontSize:'14px',color:'#fff',marginBottom:'20px',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>全国の出店場所・出店者をつなぐマッチングサービス</p>
          <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
            <Link href='/places' style={{background:'#F5A623',color:'#111',padding:'12px 20px',borderRadius:'8px',fontWeight:'700',textDecoration:'none',fontSize:'14px'}}>出店場所を探す</Link>
            <Link href='/register' style={{background:'#fff',color:'#111',padding:'12px 20px',borderRadius:'8px',fontWeight:'700',textDecoration:'none',fontSize:'14px',border:'2px solid #F5A623'}}>無料で登録</Link>
          </div>
        </div>
        
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',borderBottom:'1px solid #eee',background:'#fff'}}>
        {[['掲載場所','1,240+'],['登録出店者','3,800+'],['マッチング実績','12,500+'],['平均評価','4.8★']].map(([l,v])=>(
          <div key={l} style={{padding:'16px',textAlign:'center',borderRight:'1px solid #eee'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#111'}}>{v}</div>
            <div style={{fontSize:'11px',color:'#111'}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'24px 16px',maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#111'}}>新着の出店場所</h2>
          <Link href='/places' style={{color:'#111',fontWeight:'700',textDecoration:'none',fontSize:'14px'}}>もっと見る →</Link>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
          {places.map(p=>(
            <div key={p.id} style={{background:'#fff',borderRadius:'12px',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
              <div style={{background:'#F5A623',height:'120px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px',position:'relative'}}>
                {p.emoji}
                {p.isNew && <span style={{position:'absolute',top:'8px',left:'8px',background:'#e53e3e',color:'#111',fontSize:'10px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px'}}>NEW</span>}
                <span style={{position:'absolute',top:'8px',right:'8px',background:'rgba(0,0,0,0.5)',color:'#111',fontSize:'10px',padding:'2px 6px',borderRadius:'4px'}}>📍{p.area}</span>
              </div>
              <div style={{padding:'12px'}}>
                <div style={{display:'flex',gap:'4px',marginBottom:'6px'}}>
                  <span style={{background:'#FFF3CD',color:'#111',fontSize:'10px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px'}}>{p.type}</span>
                </div>
                <div style={{fontWeight:'700',fontSize:'13px',marginBottom:'4px',lineHeight:1.4,color:'#111'}}>{p.name}</div>
                <div style={{fontWeight:'900',fontSize:'14px',color:'#111',marginBottom:'4px'}}>{p.price}</div>
                <div style={{fontSize:'11px',color:'#111'}}>⏰ {p.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px 24px',maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#111'}}>出店者を探す</h2>
          <Link href='/sellers' style={{color:'#111',fontWeight:'700',textDecoration:'none',fontSize:'14px'}}>もっと見る →</Link>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
          {vendors.map(v=>(
            <div key={v.id} style={{background:'#fff',borderRadius:'12px',padding:'16px',textAlign:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
              <div style={{fontSize:'36px',marginBottom:'8px'}}>{v.emoji}</div>
              <div style={{fontWeight:'700',fontSize:'13px',color:'#111'}}>{v.name}</div>
              <div style={{fontSize:'11px',color:'#111',marginBottom:'4px'}}>{v.genre}</div>
              <div style={{color:'#111',fontSize:'12px',fontWeight:'700'}}>★ {v.rating}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px 24px',maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',alignItems:'stretch'}}>
          <Link href='/vendor' style={{textDecoration:'none'}}>
            <div style={{background:'#F5A623',borderRadius:'12px',padding:'20px',height:'100%',boxSizing:'border-box'}}>
              
              <div style={{fontWeight:'900',fontSize:'14px',color:'#fff',marginBottom:'4px'}}>出店したい方へ</div>
              <div style={{fontSize:'11px',color:'#fff',marginBottom:'8px'}}>全国の出店場所を無料で探せます</div>
              <div style={{fontSize:'12px',color:'#fff',fontWeight:'700'}}>詳しく見る →</div>
            </div>
          </Link>
          <Link href='/space' style={{textDecoration:'none'}}>
            <div style={{background:'#fff',borderRadius:'12px',padding:'20px',border:'2px solid #F5A623',height:'100%',boxSizing:'border-box'}}>
              <div style={{fontSize:'32px',marginBottom:'8px'}}>📣</div>
              <div style={{fontWeight:'900',fontSize:'14px',color:'#111',marginBottom:'4px'}}>お店を呼びたい方へ</div>
              <div style={{fontSize:'11px',color:'#111',marginBottom:'8px'}}>全国の出店者を無料で募集できます</div>
              <div style={{fontSize:'12px',color:'#111',fontWeight:'700'}}>詳しく見る →</div>
            </div>
          </Link>
        </div>
      </div>
      <footer style={{background:'#F5A623',color:'#111',padding:'24px 16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
            <span style={{background:'#F5A623',color:'#111',fontWeight:'900',fontSize:'13px',padding:'4px 8px',borderRadius:'4px'}}>出店</span>
            <span style={{fontWeight:'900',fontSize:'16px'}}>コネクト<span style={{color:'#111'}}>ナビ</span></span>
          </div>
          <div style={{display:'flex',gap:'16px',flexWrap:'wrap',fontSize:'12px',marginBottom:'12px'}}>
            {['利用規約','プライバシーポリシー','お問い合わせ','運営会社','ブログ'].map(item=>(
              <a key={item} href='#' style={{color:'#111',textDecoration:'none',fontWeight:'700'}}>{item}</a>
            ))}
          </div>
          <div style={{fontSize:'11px',color:'#111'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  )
}
