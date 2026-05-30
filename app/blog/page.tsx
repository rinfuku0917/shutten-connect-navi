import Link from 'next/link'

const posts = [
  {id:'1',title:'キッチンカー出店で月収100万円を達成した出店者さんにインタビュー',category:'インタビュー',date:'2026年5月28日',img:'🎤',summary:'今回は東京都内で活躍するキッチンカー出店者の田中さんにお話を伺いました。出店コネクトナビを使って月収100万円を達成した秘訣とは？',tags:['インタビュー','キッチンカー','成功事例']},
  {id:'2',title:'初めてのキッチンカー出店！準備から当日までの完全ガイド',category:'ガイド',date:'2026年5月25日',img:'📖',summary:'キッチンカーで初めて出店する方向けに、準備から当日の流れまでを詳しく解説します。必要な許可証・保険・設備チェックリスト付き。',tags:['初心者','ガイド','キッチンカー']},
  {id:'3',title:'2026年春のおすすめ出店イベント情報まとめ',category:'イベント情報',date:'2026年5月20日',img:'🌸',summary:'春のイベントシーズン到来！全国で開催される出店募集中のイベントをまとめました。エリア別に探せます。',tags:['イベント','春','おすすめ']},
  {id:'4',title:'出店場所オーナーが語る「こんな出店者に来てほしい」',category:'インタビュー',date:'2026年5月15日',img:'🏪',summary:'商業施設や大学など、出店場所のオーナーさんたちにアンケート調査。どんな出店者を求めているのか本音を聞きました。',tags:['インタビュー','募集者','マッチング']},
  {id:'5',title:'テント出店 vs キッチンカー出店 どちらが有利？徹底比較',category:'ノウハウ',date:'2026年5月10日',img:'⚡',summary:'初期費用・運用コスト・売上・機動性など様々な角度からテント出店とキッチンカー出店を比較しました。',tags:['ノウハウ','比較','テント','キッチンカー']},
  {id:'6',title:'出店に必要な許可証・保険を徹底解説',category:'ガイド',date:'2026年5月5日',img:'📋',summary:'食品営業許可・PL保険・食品衛生責任者資格など、出店に必要な書類と手続きを詳しく解説します。',tags:['許可証','保険','ガイド']},
]

const categories = ['すべて','インタビュー','ガイド','ノウハウ','イベント情報','お知らせ']

export default function BlogPage() {
  const featured = posts[0]
  const rest = posts.slice(1)
  return (
    <div style={{minHeight:'100vh',background:'#f6f6f6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      

      <div style={{background:'#fff',borderBottom:'1px solid #e0e0e0',padding:'16px 0'}}>
        <div style={{maxWidth:'900px',margin:'0 auto',padding:'0 16px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {categories.map(cat=>(
            <button key={cat} style={{background:cat==='すべて'?'#F5A623':'#f6f6f6',color:cat==='すべて'?'#fff':'#555',border:cat==='すべて'?'none':'1px solid #e0e0e0',borderRadius:'999px',padding:'6px 16px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <Link href={'/blog/'+featured.id} style={{textDecoration:'none',color:'inherit'}}>
          <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e0e0e0',overflow:'hidden',marginBottom:'32px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',display:'grid',gridTemplateColumns:'1fr 1fr'}}>
            <div style={{background:'linear-gradient(135deg,#FFF8E1,#FFE082)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'80px',minHeight:'220px'}}>
              {featured.img}
            </div>
            <div style={{padding:'28px'}}>
              <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
                <span style={{background:'#F5A623',color:'#fff',fontSize:'11px',fontWeight:'700',padding:'3px 10px',borderRadius:'999px'}}>{featured.category}</span>
                <span style={{background:'#FF4B4B',color:'#fff',fontSize:'11px',fontWeight:'700',padding:'3px 10px',borderRadius:'999px'}}>NEW</span>
              </div>
              <h2 style={{fontSize:'20px',fontWeight:'900',color:'#1a1a1a',marginBottom:'12px',lineHeight:1.5}}>{featured.title}</h2>
              <p style={{fontSize:'13px',color:'#666',lineHeight:1.8,marginBottom:'16px'}}>{featured.summary}</p>
              <div style={{fontSize:'12px',color:'#999'}}>{featured.date}</div>
            </div>
          </div>
        </Link>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'32px'}}>
          {rest.map(post=>(
            <Link key={post.id} href={'/blog/'+post.id} style={{textDecoration:'none',color:'inherit'}}>
              <div style={{background:'#fff',borderRadius:'8px',border:'1px solid #e0e0e0',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                <div style={{background:'linear-gradient(135deg,#f5f5f5,#e8e8e8)',height:'120px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px'}}>
                  {post.img}
                </div>
                <div style={{padding:'16px'}}>
                  <span style={{background:'#FFF3E0',color:'#E65100',fontSize:'11px',fontWeight:'700',padding:'2px 8px',borderRadius:'3px',marginBottom:'8px',display:'inline-block'}}>{post.category}</span>
                  <h3 style={{fontSize:'14px',fontWeight:'900',color:'#1a1a1a',marginBottom:'8px',lineHeight:1.5,height:'42px',overflow:'hidden'}}>{post.title}</h3>
                  <p style={{fontSize:'12px',color:'#888',lineHeight:1.7,marginBottom:'10px',height:'40px',overflow:'hidden'}}>{post.summary}</p>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'8px'}}>
                    {post.tags.map(t=>(
                      <span key={t} style={{background:'#f6f6f6',color:'#666',fontSize:'10px',padding:'2px 6px',borderRadius:'3px'}}>#{t}</span>
                    ))}
                  </div>
                  <div style={{fontSize:'11px',color:'#bbb'}}>{post.date}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <footer style={{background:'#1a1a1a',color:'#fff',padding:'32px 16px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
            <span style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'13px',padding:'4px 8px',borderRadius:'4px'}}>出店</span>
            <span style={{fontWeight:'900',fontSize:'16px'}}>コネクト<span style={{color:'#F5A623'}}>ナビ</span></span>
          </div>
          <div style={{fontSize:'11px',color:'#666'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  )
}
