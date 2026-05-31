'use client'
import Link from 'next/link'
import { useState } from 'react'

const places = [
  {id:'1',img:'🏫',tag:'常設',area:'東京',title:'日本体育大学医療専門学校',fee:'日額5,000円',type:'キッチンカー',isNew:true},
  {id:'2',img:'🏫',tag:'常設',area:'大阪',title:'大阪公立大学りんくうキャンパス',fee:'無料',type:'キッチンカー',isNew:true},
  {id:'3',img:'🏬',tag:'常設',area:'宮城',title:'イオンモール富谷',fee:'要相談',type:'キッチンカー・物販',isNew:false},
  {id:'4',img:'🏫',tag:'常設',area:'東京',title:'町田美容専門学校',fee:'日額3,000円',type:'キッチンカー',isNew:false},
  {id:'5',img:'🏢',tag:'常設',area:'福岡',title:'福岡天神エリア オフィスビル',fee:'無料',type:'キッチンカー',isNew:false},
  {id:'6',img:'🌳',tag:'イベント',area:'神奈川',title:'横浜みなとみらい 週末マルシェ',fee:'日額8,000円',type:'テント・物販',isNew:false},
]

const sellers = [
  {img:'🐙',name:'たこ焼き大阪屋',genre:'たこ焼き',rating:'4.8'},
  {img:'🥞',name:'La France',genre:'クレープ',rating:'4.9'},
  {img:'🍢',name:'炭火屋',genre:'焼き鳥',rating:'4.7'},
  {img:'🍛',name:'スパイス',genre:'カレー',rating:'4.6'},
  {img:'☕',name:'BREW',genre:'コーヒー',rating:'4.9'},
  {img:'🌮',name:'ソウルキッチン',genre:'韓国料理',rating:'4.5'},
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

const navItems = [
  {label:'ホーム',href:'/'},
  {label:'出店したい',href:'/vendor'},
  {label:'お店を呼びたい',href:'/space'},
  {label:'出店者を探す',href:'/sellers'},
  {label:'出店場所を探す',href:'/places'},
  {label:'車両を売りたい',href:'/sell'},
  {label:'ブログ',href:'/blog'},
]

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{minHeight:'100vh',background:'#f6f6f6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      

      <div style={{background:'#fff',borderBottom:'1px solid #e0e0e0',padding:'10px 0',overflowX:'auto'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px',display:'flex',gap:'8px'}}>
          {cats.map(c=>(
            <button key={c.label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',background:'#f6f6f6',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'8px 12px',cursor:'pointer',flexShrink:0,minWidth:'64px'}}>
              {(c as any).isImg
                ? <img src={c.icon} style={{height:'28px',width:'28px',objectFit:'contain',mixBlendMode:'multiply'}}/>
                : <span style={{fontSize:'20px'}}>{c.icon}</span>
              }
              <span style={{fontSize:'11px',color:'#555',fontWeight:'600',whiteSpace:'nowrap'}}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{background:'linear-gradient(135deg,#FFF8E1,#FFF3C4)',borderBottom:'1px solid #FFE082',padding:'24px 16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
          <div style={{flex:1}}>
            
            <h1 style={{fontSize:'28px',fontWeight:'900',color:'#1a1a1a',marginBottom:'8px',lineHeight:1.3}}>最高の出店場所が<br/>見つかる</h1>
            <p style={{fontSize:'13px',color:'#666',marginBottom:'16px',lineHeight:1.6}}>全国の出店場所・出店者をつなぐマッチングサービス</p>
            <div style={{display:'flex',gap:'10px'}}>
              <Link href='/places' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'12px 16px',borderRadius:'8px',textDecoration:'none',whiteSpace:'nowrap'}}>出店場所を探す</Link>
              <Link href='/register' style={{background:'#fff',color:'#F5A623',fontWeight:'900',fontSize:'14px',border:'2px solid #F5A623',padding:'10px 16px',borderRadius:'8px',textDecoration:'none',whiteSpace:'nowrap'}}>無料で登録</Link>
            </div>
          </div>
          <img src='/kitchen-car.png' style={{height:'110px',objectFit:'contain',mixBlendMode:'multiply',flexShrink:0}}/>
        </div>
      </div>

      <div style={{background:'#fff',padding:'12px 0',borderBottom:'1px solid #e0e0e0'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px',display:'flex',justifyContent:'space-around'}}>
          {[{num:'1,248',label:'掲載場所'},{num:'3,410',label:'登録出店者'},{num:'647',label:'マッチング実績'},{num:'4.8',label:'平均評価'}].map(s=>(
            <div key={s.label} style={{textAlign:'center'}}>
              
              <div style={{fontSize:'11px',color:'#999',marginTop:'2px'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'20px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <h2 style={{fontSize:'17px',fontWeight:'900',color:'#1a1a1a'}}>新着の出店場所</h2>
          <Link href='/places' style={{fontSize:'13px',color:'#F5A623',fontWeight:'700',textDecoration:'none',whiteSpace:'nowrap'}}>もっと見る →</Link>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'12px'}}>
          {places.map(place=>(
            <Link key={place.id} href={'/places/'+place.id} style={{textDecoration:'none',color:'inherit'}}>
              <div style={{background:'#fff',borderRadius:'8px',overflow:'hidden',border:'1px solid #e0e0e0',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',display:'flex',flexDirection:'column',height:'100%'}}>
                <div style={{height:'120px',background:'linear-gradient(135deg,#f5f5f5,#e8e8e8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'40px',position:'relative',flexShrink:0}}>
                  {place.img}
                  {place.isNew && <div style={{position:'absolute',top:'6px',left:'6px',background:'#FF4B4B',color:'#fff',fontSize:'9px',fontWeight:'700',padding:'2px 6px',borderRadius:'3px'}}>NEW</div>}
                  <div style={{position:'absolute',top:'6px',right:'6px',background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:'9px',padding:'2px 6px',borderRadius:'3px'}}>{place.area}</div>
                </div>
                <div style={{padding:'10px',flex:1,display:'flex',flexDirection:'column'}}>
                  <div style={{fontSize:'12px',fontWeight:'700',color:'#1a1a1a',marginBottom:'4px',lineHeight:1.4,flex:1}}>{place.title}</div>
                  
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                    <span style={{background:'#FFF3E0',color:'#E65100',fontSize:'10px',padding:'2px 5px',borderRadius:'3px',fontWeight:'600'}}>{place.tag}</span>
                    <span style={{background:'#F3F4F6',color:'#555',fontSize:'10px',padding:'2px 5px',borderRadius:'3px'}}>{place.type}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 16px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <h2 style={{fontSize:'17px',fontWeight:'900',color:'#1a1a1a'}}>出店者を探す</h2>
          <Link href='/sellers' style={{fontSize:'13px',color:'#F5A623',fontWeight:'700',textDecoration:'none',whiteSpace:'nowrap'}}>もっと見る →</Link>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
          {sellers.map(s=>(
            <Link key={s.name} href='/sellers' style={{textDecoration:'none',color:'inherit'}}>
              <div style={{background:'#fff',borderRadius:'8px',border:'1px solid #e0e0e0',padding:'12px 8px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                <div style={{fontSize:'28px',marginBottom:'6px'}}>{s.img}</div>
                <div style={{fontSize:'11px',fontWeight:'700',color:'#1a1a1a',marginBottom:'2px'}}>{s.name}</div>
                <div style={{fontSize:'10px',color:'#999',marginBottom:'4px'}}>{s.genre}</div>
                
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{background:'#fff',borderTop:'1px solid #e0e0e0',padding:'16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
          <Link href='/vendor' style={{textDecoration:'none'}}>
            <div style={{background:'linear-gradient(135deg,#FFF8E1,#FFE082)',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'8px',border:'1px solid #FFD54F',height:'100%',boxSizing:'border-box'}}>
              <img src='/kitchen-car.png' style={{height:'36px',objectFit:'contain',mixBlendMode:'multiply'}}/>
              <div style={{fontWeight:'900',fontSize:'14px',color:'#1a1a1a'}}>出店したい方へ</div>
              <div style={{fontSize:'11px',color:'#666',lineHeight:1.6,flex:1}}>全国の出店場所を無料で探せます</div>
              
            </div>
          </Link>
          <Link href='/space' style={{textDecoration:'none'}}>
            <div style={{background:'linear-gradient(135deg,#E3F2FD,#BBDEFB)',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'8px',border:'1px solid #90CAF9',height:'100%',boxSizing:'border-box'}}>
              <span style={{fontSize:'32px'}}>📣</span>
              <div style={{fontWeight:'900',fontSize:'14px',color:'#1a1a1a'}}>お店を呼びたい方へ</div>
              <div style={{fontSize:'11px',color:'#666',lineHeight:1.6,flex:1}}>全国の出店者を無料で募集できます</div>
              <div style={{fontSize:'12px',color:'#3A9BD5',fontWeight:'700'}}>詳しく見る →</div>
            </div>
          </Link>
        </div>
      </div>

      <footer style={{background:'#1a1a1a',color:'#fff',padding:'24px 16px',marginTop:'16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
            <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'13px',padding:'4px 8px',borderRadius:'4px'}}>出店</span>
            <span style={{fontWeight:'900',fontSize:'16px'}}>コネクト<span style={{color:'#F5A623'}}>ナビ</span></span>
          </div>
          <div style={{display:'flex',gap:'16px',flexWrap:'wrap',fontSize:'12px',marginBottom:'12px'}}>
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
