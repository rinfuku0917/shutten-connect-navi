'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

const places = [
  {id:'1',title:'渋谷ヒカリエ前 週末マルシェ',area:'渋谷区・渋谷駅徒歩1分',fee:'5,000円/日',time:'土日 10:00〜17:00',type:'マルシェ'},
  {id:'2',title:'新宿駅東口 キッチンカースペース',area:'新宿区・新宿駅徒歩2分',fee:'8,000円/日',time:'平日 11:00〜15:00',type:'キッチンカー'},
  {id:'3',title:'池袋西口公園 週末イベント',area:'豊島区・池袋駅徒歩3分',fee:'3,000円/日',time:'土日 10:00〜18:00',type:'イベント'},
  {id:'4',title:'お台場海浜公園 フードフェス',area:'江東区・お台場海浜公園駅徒歩5分',fee:'10,000円/日',time:'土日祝 11:00〜20:00',type:'フェス'},
]

export default function PlacesPage() {
  return (
    <div style={{background:'#FFF8F0',minHeight:'100vh'}}>
      <Nav />
      <div style={{background:'linear-gradient(135deg,#F5A623,#F7C06E)',padding:'48px 24px',textAlign:'center'}}>
        <h1 style={{fontSize:'28px',fontWeight:'900',color:'#111',marginBottom:'8px'}}>出店場所を探す</h1>
        <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)'}}>全国の出店スペースから理想の場所を見つけよう</p>
      </div>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'grid',gap:'16px'}}>
          {places.map(place => (
            <Link key={place.id} href={'/places/' + place.id} style={{textDecoration:'none',display:'block',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'12px',padding:'20px',color:'inherit'}}>
              <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a',marginBottom:'8px'}}>{place.title}</div>
              <div style={{fontSize:'13px',color:'#111',marginBottom:'6px'}}>{place.area}</div>
              <div style={{fontSize:'14px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>{place.fee}</div>
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                <span style={{background:'#f8f9fa',color:'#111',fontSize:'11px',padding:'3px 8px',borderRadius:'4px',border:'1px solid #e8e8e8'}}>{place.time}</span>
                <span style={{background:'#EBF6FD',color:'#1565C0',fontSize:'11px',padding:'3px 8px',borderRadius:'4px'}}>🏪 {place.type}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <footer style={{background:'#F5A623',color:'#111',padding:'24px',textAlign:'center'}}>
        <Link href='/' style={{fontWeight:'900',fontSize:'16px',marginBottom:'8px',display:'block',color:'#111',textDecoration:'none'}}>出店コネクトナビ</Link>
        <div style={{fontSize:'12px',color:'#111'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
