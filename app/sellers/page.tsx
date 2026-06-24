'use client'
import Link from 'next/link'
import Nav from '../components/Nav'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Seller = {
  id: string
  name: string | null
  shop_name: string | null
  genre: string | null
  photos: string[]
  areas: string[]
  rating: number
  reviewCount: number
}

const genreEmoji = (genre: string | null): string => {
  const g = genre || ''
  if (g.includes('スイーツ') || g.includes('菓子') || g.includes('デザート')) return '🍰'
  if (g.includes('ドリンク') || g.includes('カフェ') || g.includes('コーヒー')) return '☕'
  if (g.includes('クレープ') || g.includes('軽食')) return '🥞'
  if (g.includes('弁当') || g.includes('ランチ') || g.includes('まぜそば') || g.includes('麺') || g.includes('そば')) return '🍱'
  if (g.includes('パン')) return '🥐'
  return '🏪'
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // 登録している出店者全員を取得
      const { data: sellerRows } = await supabase
        .from('profiles')
        .select('id, name, shop_name, genre, photos, areas')
        .eq('role', 'seller')
        .order('created_at', { ascending: false })
      const map = new Map<string, Seller>()
      for (const p of (sellerRows || []) as any[]) {
        if (p && !map.has(p.id)) {
          map.set(p.id, { id: p.id, name: p.name, shop_name: p.shop_name, genre: p.genre, photos: Array.isArray(p.photos) ? p.photos : [], areas: Array.isArray(p.areas) ? p.areas : [], rating: 0, reviewCount: 0 })
        }
      }
      // 各出店者の承認済みレビューの平均点・件数
      const { data: reviews } = await supabase
        .from('reviews')
        .select('seller_id, rating')
        .eq('status', 'approved')
      const agg = new Map<string, { sum: number, count: number }>()
      for (const r of (reviews || []) as any[]) {
        if (!r.seller_id) continue
        const cur = agg.get(r.seller_id) || { sum: 0, count: 0 }
        cur.sum += r.rating || 0
        cur.count += 1
        agg.set(r.seller_id, cur)
      }
      for (const [id, s] of map) {
        const a = agg.get(id)
        if (a && a.count > 0) {
          s.rating = Math.round((a.sum / a.count) * 10) / 10
          s.reviewCount = a.count
        }
      }
      setSellers(Array.from(map.values()))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{background:'#FFF8F0',minHeight:'100vh'}}>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-sellers.png) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'300px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:'900',color:'#fff',marginBottom:'12px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>出店者を探す</h1>
        <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)'}}><span style={{fontSize:'clamp(14px,2vw,20px)',color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.5)'}}>あなたのスペースに合う出店者を見つけよう</span></p>
      </div>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div className='sellers-grid' style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:'16px'}}>
          {loading && <div style={{gridColumn:'1 / -1',color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>読み込み中...</div>}
          {!loading && sellers.length === 0 && <div style={{gridColumn:'1 / -1',color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>掲載中の出店者はまだいません。</div>}
          {sellers.map(seller => (
            <Link key={seller.id} href={'/sellers/' + seller.id} className='seller-card' style={{textDecoration:'none',display:'flex',flexDirection:'column',background:'#fff',border:'1px solid #e8e8e8',borderRadius:'14px',overflow:'hidden',color:'inherit',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              {seller.photos && seller.photos.length > 0 ? (
                <div style={{width:'100%',paddingTop:'66%',position:'relative',background:'#f5f5f5'}}>
                  <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',backgroundImage:'url('+seller.photos[0]+')',backgroundSize:'cover',backgroundPosition:'center'}}></div>
                </div>
              ) : (
                <div style={{width:'100%',paddingTop:'66%',position:'relative',background:'linear-gradient(135deg,#FFF3DD,#FFE4C0)'}}>
                  <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'44px',opacity:0.5}}>{genreEmoji(seller.genre)}</div>
                </div>
              )}
              <div style={{padding:'14px',display:'flex',flexDirection:'column',gap:'6px',flex:1}}>
                <div style={{fontSize:'16px',fontWeight:'800',color:'#1a1a1a',lineHeight:1.3}}>{seller.shop_name || seller.name || '(店舗名未設定)'}</div>
                {seller.genre && <div style={{fontSize:'12px',color:'#fff',background:'#F5A623',alignSelf:'flex-start',padding:'3px 10px',borderRadius:'12px',fontWeight:'700'}}>{seller.genre}</div>}
                {seller.areas && seller.areas.length > 0 && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'2px'}}>
                    {seller.areas.slice(0, 5).map((a, i) => (
                      <span key={i} style={{fontSize:'11px',color:'#3B82F6',border:'1px solid #BFDBFE',borderRadius:'6px',padding:'2px 7px',whiteSpace:'nowrap'}}>{a}</span>
                    ))}
                    {seller.areas.length > 5 && <span style={{fontSize:'11px',color:'#94A3B8',padding:'2px 2px'}}>+{seller.areas.length - 5}</span>}
                  </div>
                )}
                <div style={{fontSize:'12px',color:'#64748B',marginTop:'auto',paddingTop:'6px'}}>{seller.reviewCount > 0 ? '★ ' + seller.rating + ' (' + seller.reviewCount + '件)' : 'レビューはまだありません'}</div>
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
