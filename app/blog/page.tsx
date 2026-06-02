'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

const posts = [
  {id:'1',title:'キッチンカー出店で月収100万円を達成した出店者さんにインタビュー',category:'インタビュー',date:'2026年5月28日',img:'🎤'},
  {id:'2',title:'初めてのキッチンカー出店！準備から当日までの完全ガイド',category:'ガイド',date:'2026年5月25日',img:'📖'},
  {id:'3',title:'2026年上半期 人気出店エリアランキング TOP10',category:'トレンド',date:'2026年5月20日',img:'📊'},
  {id:'4',title:'食品衛生責任者の取り方：費用・日程・注意点まとめ',category:'法律・許可',date:'2026年5月15日',img:'📋'},
]

export default function BlogPage() {
  return (
    <div style={{background:'#FFF8F0',minHeight:'100vh'}}>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-blog.png) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'280px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:'900',color:'#fff',marginBottom:'8px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>お役立ち情報</h1>
        <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)'}}>出店に役立つ記事・ガイドをお届けします</p>
      </div>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'grid',gap:'16px'}}>
          {posts.map(post => (
            <Link key={post.id} href={'/blog/' + post.id} style={{textDecoration:'none',display:'block',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'12px',padding:'20px',color:'inherit'}}>
              <div style={{display:'flex',gap:'16px',alignItems:'flex-start'}}>
                <div style={{fontSize:'40px',flexShrink:0}}>{post.img}</div>
                <div>
                  <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                    <span style={{background:'#FFF3E0',color:'#111',fontSize:'11px',padding:'2px 8px',borderRadius:'4px',fontWeight:'700'}}>{post.category}</span>
                    <span style={{color:'#111',fontSize:'11px'}}>{post.date}</span>
                  </div>
                  <div style={{fontSize:'15px',fontWeight:'700',color:'#1a1a1a',lineHeight:1.5}}>{post.title}</div>
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
