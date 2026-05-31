'use client'
import Link from 'next/link'
import Nav from '../components/Nav'

const posts = [
  {id:'1',title:'キッチンカー出店で月収100万円を達成した出店者さんにインタビュー',category:'インタビュー',date:'2026年5月28日',img:'🎤',tags:['インタビュー','キッチンカー','成功事例']},
  {id:'2',title:'初めてのキッチンカー出店！準備から当日までの完全ガイド',category:'ガイド',date:'2026年5月25日',img:'📖',tags:['ガイド','初心者','キッチンカー']},
  {id:'3',title:'出店場所の選び方：集客できる場所の5つの条件',category:'ノウハウ',date:'2026年5月20日',img:'📍',tags:['ノウハウ','出店場所','集客']},
  {id:'4',title:'食品衛生責任者の資格取得方法と費用を徹底解説',category:'ガイド',date:'2026年5月15日',img:'📋',tags:['資格','食品衛生','法律']},
  {id:'5',title:'マルシェ出店で売上アップ！ディスプレイの工夫',category:'ノウハウ',date:'2026年5月10日',img:'🛍️',tags:['マルシェ','ディスプレイ','売上']},
  {id:'6',title:'キッチンカーの車両選び：中古vs新車どちらがお得？',category:'ノウハウ',date:'2026年5月5日',img:'🚐',tags:['車両','中古','購入']},
]

const categories = ['すべて','インタビュー','ガイド','ノウハウ']

export default function BlogPage() {
  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6',fontFamily:'-apple-system,sans-serif'}}>
      <div style={{background:'linear-gradient(135deg,#FFF4CC,#FFE680)',padding:'48px 24px',textAlign:'center'}}>
        <div style={{fontSize:'40px',marginBottom:'12px'}}>📝</div>
        <h1 style={{fontSize:'clamp(28px,6vw,40px)',fontWeight:'900',color:'#1a1a1a',marginBottom:'8px'}}>ブログ</h1>
        <p style={{fontSize:'15px',color:'#666'}}>出店に役立つ情報をお届けします</p>
      </div>

      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'24px'}}>
          {posts.map(post => (
            <Link key={post.id} href={`/blog/${post.id}`} style={{textDecoration:'none'}}>
              <div style={{background:'#fff',borderRadius:'16px',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.08)',transition:'transform .2s',cursor:'pointer'}}>
                <div style={{background:'linear-gradient(135deg,#FFF4CC,#FFE680)',padding:'32px',textAlign:'center',fontSize:'48px'}}>
                  {post.img}
                </div>
                <div style={{padding:'20px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <span style={{background:'#FFF3CD',color:'#E08A00',fontSize:'11px',fontWeight:'700',padding:'3px 8px',borderRadius:'20px'}}>{post.category}</span>
                    <span style={{fontSize:'12px',color:'#999'}}>{post.date}</span>
                  </div>
                  <h2 style={{fontSize:'15px',fontWeight:'700',color:'#1a1a1a',lineHeight:1.5,marginBottom:'12px'}}>{post.title}</h2>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                    {post.tags.map(tag => (
                      <span key={tag} style={{background:'#F5F5F5',color:'#666',fontSize:'11px',padding:'2px 8px',borderRadius:'20px'}}>#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
