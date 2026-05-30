import Link from 'next/link'

const places = [
  {id:'1',img:'🏫',tag:'常設',area:'東京',title:'日本体育大学医療専門学校（6〜8月スケジュール）',fee:'日額5,000円',time:'11:00〜16:00',type:'キッチンカー',isNew:true},
  {id:'2',img:'🏫',tag:'常設',area:'大阪',title:'大阪公立大学りんくうキャンパス（7月募集）',fee:'無料',time:'11:00〜14:00',type:'キッチンカー',isNew:true},
  {id:'3',img:'🏬',tag:'常設',area:'宮城',title:'イオンモール富谷',fee:'要相談',time:'10:00〜18:00',type:'キッチンカー・物販',isNew:false},
  {id:'4',img:'🏫',tag:'常設',area:'東京',title:'町田美容専門学校',fee:'日額3,000円',time:'11:00〜15:00',type:'キッチンカー',isNew:false},
  {id:'5',img:'🏢',tag:'常設',area:'福岡',title:'福岡天神エリア オフィスビル',fee:'無料',time:'11:00〜14:00',type:'キッチンカー',isNew:false},
  {id:'6',img:'🌳',tag:'イベント',area:'神奈川',title:'横浜みなとみらい 週末マルシェ',fee:'日額8,000円',time:'10:00〜17:00',type:'テント・物販',isNew:false},
  {id:'7',img:'🏫',tag:'常設',area:'愛知',title:'名古屋大学 東山キャンパス',fee:'無料',time:'11:00〜14:00',type:'キッチンカー',isNew:true},
  {id:'8',img:'🌳',tag:'イベント',area:'北海道',title:'札幌大通公園 夏祭りイベント',fee:'日額10,000円',time:'10:00〜20:00',type:'キッチンカー・テント',isNew:true},
]

const cats = [
  {icon:'/kitchen-car.png',label:'キッチンカー',isImg:true},
  {icon:'/tent.png',label:'テント',isImg:true},
  {icon:'🏪',label:'常設'},
  {icon:'🎪',label:'イベント'},
  {icon:'🏫',label:'学校・大学'},
  {icon:'🏢',label:'オフィス'},
  {icon:'🛍️',label:'商業施設'},
  {icon:'🌳',label:'公園・屋外'},
]

export default function HomePage() {
  return (
    <div style={{minHeight:'100vh',background:'#f6f6f6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      <header style={{background:'#fff',borderBottom:'1px solid #e0e0e0',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px',height:'56px',display:'flex',alignItems:'center',gap:'16px'}}>
          <Link href='/' style={{display:'flex',alignItems:'center',gap:'6px',textDecoration:'none',flexShrink:0}}>
            <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'13px',padding:'4px 8px',borderRadius:'4px'}}>出店</span>
            <span style={{fontWeight:'900',fontSize:'16px',color:'#1a1a1a'}}>コネクト<span style={{color:'#F5A623'}}>ナビ</span></span>
          </Link>
          <div style={{flex:1,position:'relative'}}>
            <input placeholder='場所・エリア・ジャンルで探す' style={{width:'100%',border:'1px solid #e0e0e0',borderRadius:'24px',padding:'8px 16px 8px 40px',fontSize:'14px',background:'#f6f6f6',boxSizing:'border-box',outline:'none'}}/>
            <span style={{position:'absolute',left:'14px',top:'50%',transform:'translateY(-50%)',fontSize:'16px',color:'#999'}}>🔍</span>
          </div>
          <div style={{display:'flex',gap:'8px',flexShrink:0}}>
            <Link href='/login' style={{color:'#555',fontSize:'13px',fontWeight:'600',textDecoration:'none',padding:'6px 12px',borderRadius:'4px',border:'1px solid #ddd'}}>ログイン</Link>
            <Link href='/register' style={{background:'#F5A623',color:'#fff',fontSize:'13px',fontWeight:'900',textDecoration:'none',padding:'6px 14px',borderRadius:'4px'}}>会員登録</Link>
          </div>
        </div>
        <div style={{borderTop:'1px solid #f0f0f0',overflowX:'auto'}}>
          <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px',display:'flex'}}>
            {[{label:'ホーム',href:'/'},{label:'出店したい',href:'/vendor'},{label:'お店を呼びたい',href:'/space'},{label:'出店者を探す',href:'/sellers'},{label:'出店場所を探す',href:'/places'},{label:'車両を売りたい',href:'/sell'},{label:'ブログ',href:'/blog'}].map(item=>(
              <Link key={item.label} href={item.href} style={{color:'#333',fontSize:'13px',fontWeight:'600',padding:'10px 16px',textDecoration:'none',whiteSpace:'nowrap',display:'block'}}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div style={{background:'#fff',borderBottom:'1px solid #e0e0e0',padding:'12px 0'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px',display:'flex',gap:'8px',overflowX:'auto'}}>
          {cats.map(c=>(
            <button key={c.label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',background:'#f6f6f6',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'10px 16px',cursor:'pointer',flexShrink:0,minWidth:'72px'}}>
              {c.isImg ? <img src={c.icon} style={{height:'36px',width:'36px',objectFit:'contain',mixBlendMode:'multiply'}} /> : <span style={{fontSize:'22px'}}>{c.icon}</span>}
              <span style={{fontSize:'11px',color:'#555',fontWeight:'600',whiteSpace:'nowrap'}}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{background:'linear-gradient(135deg,#FFF8E1,#FFF3C4)',borderBottom:'1px solid #FFE082',padding:'32px 16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{display:'inline-block',background:'#F5A623',color:'#fff',fontSize:'12px',fontWeight:'700',padding:'3px 12px',borderRadius:'999px',marginBottom:'12px'}}>出店場所 × 出店者 マッチング</div>
            <h1 style={{fontSize:'32px',fontWeight:'900',color:'#1a1a1a',marginBottom:'8px',lineHeight:1.3}}>最高の出店場所が<br/>見つかる</h1>
            <p style={{fontSize:'14px',color:'#666',marginBottom:'20px',lineHeight:1.7}}>全国の出店場所・出店者をつなぐマッチングサービス</p>
            <div style={{display:'flex',gap:'12px'}}>
              <Link href='/places' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'12px 28px',borderRadius:'8px',textDecoration:'none'}}>出店場所を探す</Link>
              <Link href='/register' style={{background:'#fff',color:'#F5A623',fontWeight:'900',fontSize:'14px',border:'2px solid #F5A623',padding:'12px 28px',borderRadius:'8px',textDecoration:'none'}}>無料で登録</Link>
            </div>
          </div>
          <img src="/kitchen-car.png" style={{height:"160px",objectFit:"contain",mixBlendMode:"multiply"}} />
        </div>
      </div>

      <div style={{background:'#fff',padding:'12px 0',borderBottom:'1px solid #e0e0e0'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px',display:'flex',justifyContent:'space-around'}}>
          {[{num:'1,248',label:'掲載場所'},{num:'3,410',label:'登録出店者'},{num:'647',label:'マッチング実績'},{num:'4.8',label:'平均評価'}].map(s=>(
            <div key={s.label} style={{textAlign:'center'}}>
              <div style={{fontSize:'22px',fontWeight:'900',color:'#F5A623'}}>{s.num}</div>
              <div style={{fontSize:'11px',color:'#999',marginTop:'2px'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'24px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#1a1a1a'}}>新着の出店場所</h2>
          <Link href='/places' style={{fontSize:'13px',color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>もっと見る →</Link>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
          {places.map(place=>(
            <Link key={place.id} href={'/places/'+place.id} style={{textDecoration:'none',color:'inherit'}}>
              <div style={{background:'#fff',borderRadius:'8px',overflow:'hidden',border:'1px solid #e0e0e0',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                <div style={{height:'140px',background:'linear-gradient(135deg,#f5f5f5,#e8e8e8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px',position:'relative'}}>
                  {place.img}
                  {place.isNew && <div style={{position:'absolute',top:'8px',left:'8px',background:'#FF4B4B',color:'#fff',fontSize:'10px',fontWeight:'700',padding:'2px 8px',borderRadius:'3px'}}>NEW</div>}
                  <div style={{position:'absolute',top:'8px',right:'8px',background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:'10px',padding:'2px 8px',borderRadius:'3px'}}>{place.area}</div>
                </div>
                <div style={{padding:'10px 12px'}}>
                  <div style={{fontSize:'12px',fontWeight:'700',color:'#1a1a1a',marginBottom:'4px',lineHeight:1.4,height:'34px',overflow:'hidden'}}>{place.title}</div>
                  <div style={{fontSize:'13px',fontWeight:'900',color:'#F5A623',marginBottom:'6px'}}>{place.fee}</div>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                    <span style={{background:'#FFF3E0',color:'#E65100',fontSize:'10px',padding:'2px 6px',borderRadius:'3px',fontWeight:'600'}}>{place.tag}</span>
                    <span style={{background:'#F3F4F6',color:'#555',fontSize:'10px',padding:'2px 6px',borderRadius:'3px'}}>{place.type}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px 24px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#1a1a1a'}}>出店者を探す</h2>
          <Link href='/sellers' style={{fontSize:'13px',color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>もっと見る →</Link>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'12px'}}>
          {[{img:'🐙',name:'たこ焼き大阪屋',genre:'たこ焼き',rating:'4.8'},{img:'🥞',name:'La France',genre:'クレープ',rating:'4.9'},{img:'🍢',name:'炭火屋',genre:'焼き鳥',rating:'4.7'},{img:'🍛',name:'スパイス',genre:'カレー',rating:'4.6'},{img:'☕',name:'BREW',genre:'コーヒー',rating:'4.9'},{img:'🌮',name:'ソウルキッチン',genre:'韓国料理',rating:'4.5'}].map(s=>(
            <Link key={s.name} href='/sellers' style={{textDecoration:'none',color:'inherit'}}>
              <div style={{background:'#fff',borderRadius:'8px',border:'1px solid #e0e0e0',padding:'16px 12px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                <div style={{fontSize:'36px',marginBottom:'8px'}}>{s.img}</div>
                <div style={{fontSize:'12px',fontWeight:'700',color:'#1a1a1a',marginBottom:'2px'}}>{s.name}</div>
                <div style={{fontSize:'11px',color:'#999',marginBottom:'4px'}}>{s.genre}</div>
                <div style={{fontSize:'11px',color:'#F5A623',fontWeight:'700'}}>★ {s.rating}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{background:'#fff',borderTop:'1px solid #e0e0e0',padding:'24px 16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
          <Link href='/vendor' style={{textDecoration:'none'}}>
            <div style={{background:'linear-gradient(135deg,#FFF8E1,#FFE082)',borderRadius:'12px',padding:'24px',display:'flex',alignItems:'center',gap:'16px',border:'1px solid #FFD54F'}}>
              <img src="/kitchen-car.png" style={{height:"48px",objectFit:"contain",mixBlendMode:"multiply"}} />
              <div>
                <div style={{fontWeight:'900',fontSize:'16px',color:'#1a1a1a',marginBottom:'4px'}}>出店したい方へ</div>
                <div style={{fontSize:'12px',color:'#666',lineHeight:1.6}}>全国の出店場所を無料で探せます</div>
                <div style={{fontSize:'12px',color:'#F5A623',fontWeight:'700',marginTop:'8px'}}>詳しく見る →</div>
              </div>
            </div>
          </Link>
          <Link href='/space' style={{textDecoration:'none'}}>
            <div style={{background:'linear-gradient(135deg,#E3F2FD,#BBDEFB)',borderRadius:'12px',padding:'24px',display:'flex',alignItems:'center',gap:'16px',border:'1px solid #90CAF9'}}>
              <span style={{fontSize:'48px'}}>📣</span>
              <div>
                <div style={{fontWeight:'900',fontSize:'16px',color:'#1a1a1a',marginBottom:'4px'}}>お店を呼びたい方へ</div>
                <div style={{fontSize:'12px',color:'#666',lineHeight:1.6}}>全国の出店者を無料で募集できます</div>
                <div style={{fontSize:'12px',color:'#3A9BD5',fontWeight:'700',marginTop:'8px'}}>詳しく見る →</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <footer style={{background:'#1a1a1a',color:'#fff',padding:'32px 16px',marginTop:'24px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
            <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'13px',padding:'4px 8px',borderRadius:'4px'}}>出店</span>
            <span style={{fontWeight:'900',fontSize:'16px'}}>コネクト<span style={{color:'#F5A623'}}>ナビ</span></span>
          </div>
          <div style={{display:'flex',gap:'24px',flexWrap:'wrap',fontSize:'12px',marginBottom:'16px'}}>
            {['利用規約','プライバシーポリシー','お問い合わせ','運営会社','ブログ'].map(item=>(
              <a key={item} href='#' style={{color:'#999',textDecoration:'none'}}>{item}</a>
            ))}
          </div>
          <div style={{fontSize:'11px',color:'#666'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  )
}
