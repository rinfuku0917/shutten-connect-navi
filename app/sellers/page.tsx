import Link from 'next/link'
import Nav from '../components/Nav'

const sellers = [
  {id:'1',name:'たこ焼き 大阪屋',genre:'たこ焼き・粉もの',area:'関西',img:'🐙',rating:4.8,count:42,tags:['キッチンカー','ランチ','イベント']},
  {id:'2',name:'クレープ専門 La France',genre:'クレープ・スイーツ',area:'関東',img:'🥞',rating:4.9,count:38,tags:['キッチンカー','スイーツ','週末']},
  {id:'3',name:'焼き鳥 炭火屋',genre:'焼き鳥・串もの',area:'九州',img:'🍢',rating:4.7,count:55,tags:['キッチンカー','夜市','イベント']},
  {id:'4',name:'カレー専門店 スパイス',genre:'カレー',area:'関東',img:'🍛',rating:4.6,count:29,tags:['キッチンカー','ランチ','オフィス']},
  {id:'5',name:'ハンドメイドアクセサリー Miel',genre:'アクセサリー・雑貨',area:'関西',img:'💍',rating:5.0,count:18,tags:['物販','マルシェ','週末']},
  {id:'6',name:'コーヒースタンド BREW',genre:'コーヒー・ドリンク',area:'関東',img:'☕',rating:4.9,count:63,tags:['キッチンカー','カフェ','オフィス']},
  {id:'7',name:'韓国料理 ソウルキッチン',genre:'韓国料理',area:'関東',img:'🌮',rating:4.5,count:22,tags:['キッチンカー','ランチ','イベント']},
  {id:'8',name:'クラフトビール 麦畑',genre:'ビール・ドリンク',area:'中部',img:'🍺',rating:4.7,count:31,tags:['キッチンカー','イベント','夜市']},
]

const areas = ['すべて','関東','関西','九州','中部','東北','北海道・沖縄']
const genres = ['すべて','キッチンカー','物販','ワークショップ','スイーツ','飲食','雑貨']

export default function SellersPage() {
  return (
    <>
      <Nav />
      <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      
      
      <div style={{background:'linear-gradient(135deg,#FFF4B0,#FFE44D)',padding:'40px 24px',textAlign:'center'}}>
        <h1 style={{fontSize:'32px',fontWeight:'900',marginBottom:'8px'}}>出店者を探す</h1>
        <p style={{fontSize:'14px',color:'#555'}}>全国{sellers.length}名以上の出店者が登録中</p>
      </div>
      <div style={{background:'#fff',borderBottom:'1px solid #E5E7EB',padding:'20px 24px'}}>
        <div style={{maxWidth:'1000px',margin:'0 auto',display:'flex',gap:'16px',flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:'700',color:'#B45309',whiteSpace:'nowrap'}}>地域</span>
            <select style={{border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',background:'#fff'}}>
              {areas.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:'700',color:'#B45309',whiteSpace:'nowrap'}}>カテゴリ</span>
            <select style={{border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',background:'#fff'}}>
              {genres.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:'700',color:'#B45309',whiteSpace:'nowrap'}}>特徴</span>
            <select style={{border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',background:'#fff'}}>
              {['すべて','ランチ','イベント','週末','夜市','マルシェ','オフィス'].map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <button style={{background:'#F5A623',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 24px',fontSize:'13px',fontWeight:'900',cursor:'pointer'}}>検索する</button>
        </div>
      </div>
      <div style={{maxWidth:'1000px',margin:'0 auto',padding:'32px 24px'}}>
        <div style={{fontSize:'13px',color:'#888',marginBottom:'20px'}}>{sellers.length}件の出店者が見つかりました</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'12px'}}>
          {sellers.map(s=>(
            <Link key={s.id} href={'/sellers/'+s.id} style={{textDecoration:'none',color:'inherit'}}>
              <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #E5E7EB',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',cursor:'pointer'}}>
                <div style={{height:'120px',background:'linear-gradient(135deg,#FFF4B0,#FFE44D)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'52px'}}>{s.img}</div>
                <div style={{padding:'12px'}}>
                  <div style={{fontWeight:'900',fontSize:'13px',marginBottom:'4px',color:'#1a1a1a'}}>{s.name}</div>
                  <div style={{fontSize:'11px',color:'#888',marginBottom:'8px'}}>{s.genre} · {s.area}</div>
                  <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px'}}>
                    <span style={{color:'#F5A623',fontSize:'12px'}}>★</span>
                    <span style={{fontSize:'12px',fontWeight:'700'}}>{s.rating}</span>
                    <span style={{fontSize:'11px',color:'#888'}}>({s.count}回)</span>
                  </div>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                    {s.tags.map(t=>(
                      <span key={t} style={{background:'#FFF3CD',color:'#B45309',fontSize:'10px',padding:'2px 7px',borderRadius:'999px',fontWeight:'600'}}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <footer style={{background:'#1E2A3B',color:'#fff',padding:'24px',textAlign:'center',marginTop:'20px'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',display:'block',color:'#fff',textDecoration:'none',marginBottom:'8px'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#666'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
