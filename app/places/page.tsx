'use client'
import Link from 'next/link'
import Nav from '../components/Nav'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Place = {
  id: string
  title: string
  prefecture: string | null
  fee: string | null
  place_type: string | null
  image_url: string | null
}


export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('places')
        .select('id, title, prefecture, fee, place_type, image_url')
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      setPlaces(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{background:'#FFF8F0',minHeight:'100vh'}}>
      <Nav />
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-places.png) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'280px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:'900',color:'#fff',marginBottom:'8px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>出店場所を探す</h1>
        <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)'}}>全国の出店スペースから理想の場所を見つけよう</p>
      </div>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'grid',gap:'16px'}}>
          {loading && <div style={{color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>読み込み中...</div>}
          {!loading && places.length === 0 && <div style={{color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>掲載中の出店場所はまだありません。</div>}
          {places.map(place => (
            <Link key={place.id} href={'/places/' + place.id} style={{textDecoration:'none',display:'block',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'12px',overflow:'hidden',color:'inherit'}}>
              <div style={{height:'160px',background:'#F5A623',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px',backgroundImage:place.image_url?`url(${place.image_url})`:undefined,backgroundSize:'cover',backgroundPosition:'center'}}>
                {!place.image_url && (place.place_type==='event'?'🎪':'🏪')}
              </div>
              <div style={{padding:'20px'}}>
                <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a',marginBottom:'8px'}}>{place.title}</div>
                {place.prefecture && <div style={{fontSize:'13px',color:'#111',marginBottom:'6px'}}>📍 {place.prefecture}</div>}
                <div style={{fontSize:'14px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>{place.fee || '要相談'}</div>
                <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                  <span style={{background:'#EBF6FD',color:'#1565C0',fontSize:'11px',padding:'3px 8px',borderRadius:'4px'}}>🏪 {place.place_type==='event'?'イベント':'常設'}</span>
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
