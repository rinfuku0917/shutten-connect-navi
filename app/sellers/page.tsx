'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

const sellers = [
  {id:'1',name:'田中フードトラック',category:'カフェ・ドリンク',area:'東京都全域',rating:4.8,reviews:32,img:'☕'},
  {id:'2',name:'山田キッチンカー',category:'ランチ・弁当',area:'渋谷・新宿エリア',rating:4.6,reviews:18,img:'🍱'},
  {id:'3',name:'鈴木スイーツ',category:'スイーツ・デザート',area:'神奈川県',rating:4.9,reviews:45,img:'🍰'},
  {id:'4',name:'佐藤クレープ',category:'クレープ・軽食',area:'東京都23区',rating:4.7,reviews:27,img:'🥞'},
]

export default function SellersPage() {
  return (
    <div style={{background:'#FFF8F0',minHeight:'100vh'}}>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-sellers.png) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'300px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <h1 style={{fontSize:'clamp(32px,5vw,56px)',fontWeight:'900',color:'#fff',marginBottom:'12px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}} style={{color:'#fff',fontSize:'clamp(36px,6vw,64px)',fontWeight:'900',textShadow:'0 2px 8px rgba(0,0,0,0.5)',marginBottom:'12px'}}>出店者を探す</h1>
        <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)'}}><span style={{fontSize:'clamp(14px,2vw,20px)',color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>あなたのスペースに合う出店者を見つけよう</span></p>
      </div>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'grid',gap:'16px'}}>
          {sellers.map(seller => (
            <Link key={seller.id} href={'/sellers/' + seller.id} style={{textDecoration:'none',display:'block',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'12px',padding:'20px',color:'inherit'}}>
              <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
                <div style={{fontSize:'40px',flexShrink:0}}>{seller.img}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a',marginBottom:'4px'}}>{seller.name}</div>
                  <div style={{fontSize:'13px',color:'#111',marginBottom:'4px'}}>{seller.category} · {seller.area}</div>
                  <div style={{fontSize:'13px',color:'#111',fontWeight:'700'}}>★ {seller.rating} ({seller.reviews}件)</div>
                </div>
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
