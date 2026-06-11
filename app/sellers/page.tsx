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
      // 承認済み案件を持つ出店者だけを集める
      const { data: apps } = await supabase
        .from('applications')
        .select('seller_id, profiles(id, name, shop_name, genre)')
        .eq('status', 'approved')
      const map = new Map<string, Seller>()
      for (const a of (apps || []) as any[]) {
        const p = a.profiles
        if (p && !map.has(p.id)) {
          map.set(p.id, { id: p.id, name: p.name, shop_name: p.shop_name, genre: p.genre, rating: 0, reviewCount: 0 })
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
        <div style={{display:'grid',gap:'16px'}}>
          {loading && <div style={{color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>読み込み中...</div>}
          {!loading && sellers.length === 0 && <div style={{color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>掲載中の出店者はまだいません。</div>}
          {sellers.map(seller => (
            <Link key={seller.id} href={'/sellers/' + seller.id} style={{textDecoration:'none',display:'block',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'12px',padding:'20px',color:'inherit'}}>
              <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
                <div style={{fontSize:'40px',flexShrink:0}}>{genreEmoji(seller.genre)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a',marginBottom:'4px'}}>{seller.shop_name || seller.name || '(店舗名未設定)'}</div>
                  <div style={{fontSize:'13px',color:'#111',marginBottom:'4px'}}>{seller.genre || 'ジャンル未設定'}</div>
                  <div style={{fontSize:'13px',color:'#111',fontWeight:'700'}}>{seller.reviewCount > 0 ? '★ ' + seller.rating + ' (' + seller.reviewCount + '件)' : 'レビューはまだありません'}</div>
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
