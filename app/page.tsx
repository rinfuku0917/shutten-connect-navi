'use client'
import Link from 'next/link'
import Nav from './components/Nav'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

type Place = {
  id: string
  title: string
  prefecture: string | null
  place_type: string | null
  fee: string | null
  image_url: string | null
}

type Seller = {
  id: string
  shop_name: string | null
  name: string | null
  genre: string | null
  photos: string[] | null
  avatar_url: string | null
}
function toArr(v: string[] | string | null): string[] {
  if (!v) return []
  let arr: unknown[]
  if (Array.isArray(v)) { arr = v }
  else {
    const t = v.trim()
    if (t.startsWith('[') && t.endsWith(']')) {
      try { const j = JSON.parse(t); arr = Array.isArray(j) ? j : [t] }
      catch { arr = t.split(/[,、，]/) }
    } else { arr = t.split(/[,、，]/) }
  }
  return arr.map(x => (x ?? '').toString().replace(/^[\[\]"'\s]+|[\[\]"'\s]+$/g, '').trim()).filter(Boolean)
}
export default function Home() {
  const [places, setPlaces] = useState<Place[]>([])
  const [stats, setStats] = useState({ places: 0, sellers: 0, matches: 0, rating: 0 })
  const [sellers, setSellers] = useState<Seller[]>([])
  const [isSeller, setIsSeller] = useState(false)
  useEffect(() => {
    const loadSellers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,shop_name,name,genre,photos,avatar_url')
        .eq('role', 'seller')
        .order('created_at', { ascending: false })
        .limit(6)
      setSellers(data || [])
    }
    loadSellers()
    const load = async () => {
      const { data } = await supabase
        .from('places')
        .select('id,title,prefecture,place_type,fee,image_url')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(6)
      setPlaces(data || [])
    }
    load()
    const loadStats = async () => {
      const placesCount = await supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'published')
      const sellersCount = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller')
      const matchesCount = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'approved')
      const reviewsData = await supabase.from('reviews').select('rating').eq('status', 'approved')
      let avg = 0
      if (reviewsData.data && reviewsData.data.length > 0) {
        const sum = reviewsData.data.reduce((a, r) => a + (r.rating || 0), 0)
        avg = Math.round((sum / reviewsData.data.length) * 10) / 10
      }
      setStats({
        places: placesCount.count || 0,
        sellers: sellersCount.count || 0,
        matches: matchesCount.count || 0,
        rating: avg,
      })
    }
    loadStats()
    const checkSeller = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (prof?.role === 'seller') setIsSeller(true)
      }
    }
    checkSeller()
  }, [])
  return (
    <div style={{minHeight:'100vh',backgroundColor:'#FFF9E6',backgroundImage:'url(/top-bg.jpg)',backgroundSize:'cover',backgroundPosition:'top center',backgroundRepeat:'no-repeat',backgroundAttachment:'fixed',width:'100%',maxWidth:'100vw',overflowX:'hidden'}}>
      <Nav />
      <div style={{background:'#fff',borderBottom:'1px solid #eee',padding:'8px 16px',overflowX:'auto',whiteSpace:'nowrap'}}>
        {['キッチンカー','テント','常設','イベント','学校・大学','オフィス','商業施設','公園・屋外'].map(c=>(
          <button key={c} style={{display:'inline-block',padding:'6px 14px',margin:'0 4px',borderRadius:'20px',border:'1px solid #ddd',background:'#fff',fontSize:'13px',cursor:'pointer',whiteSpace:'nowrap',color:'#111',fontWeight:'700'}}>{c}</button>
        ))}
      </div>
      <div style={{position:'relative',padding:'40px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:'100%',overflow:'hidden'}}>
        <img src="/hero-main.jpg" alt="" style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',zIndex:0}} />
        <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',background:'linear-gradient(rgba(0,0,0,0.35),rgba(0,0,0,0.45))',zIndex:1}}></div>
        <div style={{position:'relative',zIndex:2}}>
          <h1 style={{fontSize:'clamp(24px,5vw,40px)',fontWeight:'900',color:'#fff',lineHeight:1.3,marginBottom:'12px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>最高の出店場所が<br/>見つかる</h1>
          <p style={{fontSize:'14px',color:'#fff',marginBottom:'20px',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>全国の出店場所・出店者をつなぐマッチングサービス</p>
          <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
            <Link href='/places' style={{background:'#F5A623',color:'#111',padding:'12px 20px',borderRadius:'8px',fontWeight:'700',textDecoration:'none',fontSize:'14px',border:'2px solid #F5A623'}}>出店場所を探す</Link>
            <Link href='/register' style={{background:'#fff',color:'#111',padding:'12px 20px',borderRadius:'8px',fontWeight:'700',textDecoration:'none',fontSize:'14px',border:'2px solid #F5A623'}}>無料で登録</Link>
          </div>
        </div>
        
      </div>
      <div className='grid-4' style={{borderBottom:'1px solid #eee',background:'#fff',gap:'0'}}>
        {[['掲載場所',String(stats.places)],['登録出店者',String(stats.sellers)],['マッチング実績',String(stats.matches)],['平均評価',stats.rating > 0 ? stats.rating + '★' : '-']].map(([l,v])=>(
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
        <div className='grid-auto' style={{gap:'16px'}}>
          {places.length === 0 && <div style={{color:'#999',fontSize:'14px',padding:'20px'}}>掲載中の出店場所はまだありません。</div>}
          {places.map(p=>(
            <Link key={p.id} href={'/places/' + p.id} style={{textDecoration:'none'}}>
            <div style={{background:'#fff',borderRadius:'12px',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
              <div style={{background:'#F5A623',height:'120px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px',position:'relative',backgroundImage:p.image_url?`url(${p.image_url})`:undefined,backgroundSize:'cover',backgroundPosition:'center'}}>
                {!p.image_url && (p.place_type==='event'?'🎪':'🏪')}
                {p.prefecture && <span style={{position:'absolute',top:'8px',right:'8px',background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:'10px',padding:'2px 6px',borderRadius:'4px'}}>📍{p.prefecture}</span>}
              </div>
              <div style={{padding:'12px'}}>
                <div style={{display:'flex',gap:'4px',marginBottom:'6px'}}>
                  <span style={{background:'#FFF3CD',color:'#111',fontSize:'10px',fontWeight:'700',padding:'2px 6px',borderRadius:'4px'}}>{p.place_type==='event'?'イベント':'常設'}</span>
                </div>
                <div style={{fontWeight:'700',fontSize:'13px',marginBottom:'4px',lineHeight:1.4,color:'#111'}}>{p.title}</div>
                <div style={{fontWeight:'900',fontSize:'14px',color:'#111',marginBottom:'4px'}}>{isSeller ? (p.fee || '要相談') : '🔒 ログイン後表示'}</div>
              </div>
            </div>
            </Link>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px 24px',maxWidth:'1200px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#111'}}>出店者を探す</h2>
          <Link href='/sellers' style={{color:'#111',fontWeight:'700',textDecoration:'none',fontSize:'14px'}}>もっと見る →</Link>
        </div>
        <div className='top-vendor-grid' style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
          {sellers.map(sl=>{
            const img = (sl.photos && sl.photos.length > 0) ? sl.photos[0] : (sl.avatar_url || null)
            const label = sl.shop_name || sl.name || '出店者'
            return (
            <Link key={sl.id} href={'/sellers/' + sl.id} style={{textDecoration:'none'}}>
            <div style={{background:'#fff',borderRadius:'12px',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
              {img ? (
                <div style={{width:'100%',height:'120px',backgroundImage:'url('+img+')',backgroundSize:'cover',backgroundPosition:'center'}}></div>
              ) : (
                <div style={{width:'100%',height:'120px',background:'#F0E6D2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:'900',color:'#C9A86A'}}>{label.charAt(0)}</div>
              )}
              <div style={{padding:'12px',textAlign:'center'}}>
                <div style={{fontWeight:'700',fontSize:'13px',color:'#111',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</div>
                {(() => {
                  const gs = toArr(sl.genre)
                  return gs.length > 0 ? (
                    <div style={{display:'flex',flexWrap:'wrap',gap:'4px',justifyContent:'center',marginTop:'6px'}}>
                      {gs.map(g => (<span key={g} style={{fontSize:'10px',fontWeight:'700',color:'#B45309',background:'#FFF3E0',padding:'2px 8px',borderRadius:'999px'}}>{g}</span>))}
                    </div>
                  ) : (
                    <div style={{fontSize:'11px',color:'#777',marginTop:'4px'}}>ジャンル未設定</div>
                  )
                })()}
              </div>
            </div>
            </Link>
          )})}
        </div>
      </div>
      <div style={{padding:'0 16px 24px',maxWidth:'1200px',margin:'0 auto'}}>
        <div className='top-2card-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',alignItems:'stretch'}}>
          <Link href='/vendor' style={{textDecoration:'none'}}>
            <div style={{background:'#F5A623',borderRadius:'12px',padding:'20px',minHeight:'200px',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
              <div style={{fontSize:'32px',marginBottom:'8px'}}>🚚</div>
              <div style={{fontWeight:'900',fontSize:'14px',color:'#fff',marginBottom:'4px'}}>出店したい方へ</div>
              <div style={{fontSize:'11px',color:'#fff',marginBottom:'8px'}}>全国の出店場所を無料で探せます</div>
              <div style={{fontSize:'12px',color:'#fff',fontWeight:'700'}}>詳しく見る →</div>
            </div>
          </Link>
          <Link href='/space' style={{textDecoration:'none'}}>
            <div style={{background:'#fff',borderRadius:'12px',padding:'20px',border:'2px solid #F5A623',minHeight:'200px',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
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
          <div style={{display:'flex',gap:'16px',flexWrap:'wrap',fontSize:'12px',marginBottom:'12px'}}>
            {[{label:'利用規約',href:'/terms',ext:false},{label:'プライバシーポリシー',href:'/privacy',ext:false},{label:'お問い合わせ',href:'/contact',ext:false},{label:'運営会社',href:'/company',ext:false},{label:'ブログ',href:'/blog',ext:false}].map(item=>(
              <a key={item.label} href={item.href} target={item.ext?'_blank':undefined} rel={item.ext?'noopener noreferrer':undefined} style={{color:'#111',textDecoration:'none',fontWeight:'700'}}>{item.label}</a>
            ))}
          </div>
          <div style={{fontSize:'11px',color:'#111'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  )
}
