'use client'
import Link from 'next/link'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { PLACE_CATEGORIES } from '../lib/categories'
import { compareByTitle } from '../lib/placeSort'
import ClosedRibbon from '../components/ClosedRibbon'

// 地図はSSRでLeafletを読むと壊れるのでクライアントのみで読み込む
const PlacesMap = dynamic(() => import('../components/PlacesMap'), {
  ssr: false,
  loading: () => <div style={{ height: '420px', width: '100%', borderRadius: '12px', background: '#EEE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '13px' }}>地図を読み込み中...</div>
})

export type Place = {
  id: string
  title: string
  prefecture: string | null
  address: string | null
  fee: string | null
  price_fixed: number | null
  price_share_pct: number | null
  place_fixed_unit: string | null
  company_fixed_amount: number | null
  company_fixed_unit: string | null
  company_share_pct: number | null
  place_type: string | null
  closed: boolean | null
  genres: string[] | null
  image_url: string | null
  latitude: number | null
  longitude: number | null
}

function feeText(p: Place): string {
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  const unit = p.place_fixed_unit === 'per_event' ? '期間' : '日'
  const parts: string[] = []
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + unit)
  if (pct > 0) parts.push('売上の' + pct + '%')
  return parts.join(' ＋ ')
}

// 案件の一覧はサーバー側（page.tsx）で取得して渡す。
// そうしないと、検索エンジンが見るHTMLにカードが1枚も入らない。
export default function PlacesBrowser({ initialPlaces }: { initialPlaces: Place[] }) {
  const [places] = useState<Place[]>(initialPlaces)
  const loading = false
  const [page, setPage] = useState(1)
  // 料金はログイン済みなら表示する（出店者・募集者・管理者いずれも）
  const [canSeeFee, setCanSeeFee] = useState(false)
  const [kw, setKw] = useState('')
  // 並び順。既定は新着順（新しい案件を見つけてもらうため）。
  // 名前順にすると同じ系列（イオン、サンユーストアーなど）がまとまる。
  const [sortBy, setSortBy] = useState<'new' | 'name'>('new')
  const [pref, setPref] = useState('')
  const [genre, setGenre] = useState('')
const [showMap, setShowMap] = useState(false)
  // ログインしているかだけを確かめる（料金の表示可否に使う）
  useEffect(() => {
    const checkSeller = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCanSeeFee(true)
    }
    checkSeller()
  }, [])

  // 緯度経度が空の物件を、開いたときに1秒間隔で自動ジオコーディングして保存（ボタン不要）

  // 都道府県・ジャンルの選択肢を物件から自動生成
  const prefList = useMemo(() => Array.from(new Set(places.map(p => p.prefecture).filter(Boolean))) as string[], [places])

  // 検索フィルタ適用
  const filtered = useMemo(() => places.filter(p => {
    if (pref && p.prefecture !== pref) return false
    if (genre && !(p.genres || []).includes(genre)) return false
    if (kw) {
      const hay = ((p.title || '') + (p.prefecture || '') + (p.address || '') + (p.fee || '')).toLowerCase()
      if (!hay.includes(kw.toLowerCase())) return false
    }
    return true
  }).slice().sort((a, b) => {
    // 募集終了は、募集中のうしろにまとめる
    const ca = a.closed ? 1 : 0, cb = b.closed ? 1 : 0
    if (ca !== cb) return ca - cb
    // 新着順は読み込み時の順序（ピン留め→掲載日の降順）をそのまま使う
    if (sortBy === 'new') return 0
    return compareByTitle(a.title, b.title)
  }), [places, pref, genre, kw, sortBy])
  const PER_PAGE = 12
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageSafe = Math.min(Math.max(1, page), totalPages)
  const paged = filtered.slice((pageSafe - 1) * PER_PAGE, pageSafe * PER_PAGE)

  // 地図用ピン（緯度経度ありのみ）
  const pins = useMemo(() => filtered
    .filter(p => p.latitude != null && p.longitude != null)
    .map(p => ({ id: p.id, title: p.title, prefecture: p.prefecture, fee: p.fee, latitude: p.latitude as number, longitude: p.longitude as number })),
    [filtered])

  const selectStyle = { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '13px', color: '#1a1a1a', background: '#fff', minWidth: '140px' }

  return (
    <div style={{background:'#FFF8F0',minHeight:'100vh'}}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>
      <div style={{background:'linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url(/hero-places-new.jpg) center/cover no-repeat',padding:'80px 24px',textAlign:'center',minHeight:'280px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <h1 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:'900',color:'#fff',marginBottom:'8px',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>出店場所を探す</h1>
        <p style={{fontSize:'14px',color:'rgba(255,255,255,0.9)'}}>全国の出店スペースから理想の場所を見つけよう</p>
      </div>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>

        {/* 検索フィルタ */}
        <div style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:'12px', padding:'16px', marginBottom:'20px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={kw} onChange={e=>setKw(e.target.value)} placeholder='キーワード（場所名・住所など）' style={{ ...selectStyle, flex:'1 1 200px' }} />
          <select value={pref} onChange={e=>setPref(e.target.value)} style={selectStyle}>
            <option value=''>都道府県（すべて）</option>
            {prefList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={genre} onChange={e=>setGenre(e.target.value)} style={selectStyle}>
            <option value=''>カテゴリー（すべて）</option>
            {PLACE_CATEGORIES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as 'new' | 'name')} style={selectStyle}>
            <option value='new'>新着順</option>
            <option value='name'>名前順</option>
          </select>
          {(kw || pref || genre) && (
            <button onClick={()=>{setKw('');setPref('');setGenre('')}} style={{ padding:'10px 14px', borderRadius:'8px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'13px', cursor:'pointer', color:'#64748B' }}>クリア</button>
          )}
        </div>

        {/* 地図（トグルで開閉） */}
        <div style={{ marginBottom:'24px' }}>
          <button onClick={() => setShowMap(v => !v)} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', color:'#1a1a1a', fontSize:'14px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
            🗺️ {showMap ? '地図を閉じる' : '地図で見る'}
            <span style={{ fontSize:'12px', color:'#888' }}>{showMap ? '▲' : '▼'}</span>
          </button>
          {showMap && (
            <div style={{ marginTop:'12px' }}>
              {loading ? (
                <div style={{ height: '320px', width: '100%', borderRadius: '12px', background: '#EEE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '13px' }}>地図を読み込み中...</div>
              ) : (
                <PlacesMap pins={pins} />
              )}
              {pins.length === 0 && !loading && (
                <div style={{ fontSize:'12px', color:'#999', marginTop:'8px', textAlign:'center' }}>地図に表示できる場所がありません（位置情報を取得中の場合があります）。</div>
              )}
            </div>
          )}
        </div>

        {/* カード一覧 */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))',gap:'16px'}}>
          {loading && <div style={{color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>読み込み中...</div>}
          {!loading && filtered.length === 0 && <div style={{color:'#999',fontSize:'14px',padding:'20px',textAlign:'center'}}>条件に合う出店場所が見つかりませんでした。</div>}
          {paged.map(place => (
            <Link key={place.id} href={'/places/' + place.id} style={{textDecoration:'none',display:'block',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'12px',overflow:'hidden',color:'inherit',position:'relative'}}>
              {place.closed && <ClosedRibbon />}
              <div style={{height:'170px',background:'#F5A623',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px',backgroundImage:place.image_url?`url(${place.image_url})`:undefined,backgroundSize:'cover',backgroundPosition:'center',filter:place.closed?'grayscale(1) opacity(0.55)':undefined}}>
                {!place.image_url && (place.place_type==='event'?'🎪':'🏪')}
              </div>
              <div style={{padding:'20px'}}>
                <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a',marginBottom:'8px'}}>{place.title}</div>
                {place.prefecture && <div style={{fontSize:'13px',color:'#111',marginBottom:'6px'}}>📍 {place.prefecture}</div>}
                <div style={{fontSize:'14px',fontWeight:'700',color:'#111',marginBottom:'8px'}}>{canSeeFee ? feeText(place) : '🔒 ログイン後表示'}</div>
                <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                  <span style={{background:'#EBF6FD',color:'#1565C0',fontSize:'11px',padding:'3px 8px',borderRadius:'4px'}}>🏪 {place.place_type==='event'?'イベント':'常設'}</span>
                  {place.closed && <span style={{background:'#FEE2E2',color:'#C81E1E',fontSize:'11px',fontWeight:700,padding:'3px 8px',borderRadius:'4px'}}>募集終了</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="places-pagination" style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'6px',flexWrap:'wrap',margin:'28px 0 8px'}}>
            <button onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({top:0,behavior:'smooth'}); }} disabled={pageSafe <= 1} style={{padding:'8px 12px',borderRadius:'8px',border:'1px solid #E2E8F0',background:'#fff',color:pageSafe<=1?'#ccc':'#1a1a1a',cursor:pageSafe<=1?'default':'pointer',fontWeight:'700'}}>←</button>
            {Array.from({length: totalPages}, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - pageSafe) <= 1).map((n, idx, arr) => (
              <span key={n} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                {idx > 0 && n - arr[idx-1] > 1 && <span style={{color:'#999'}}>…</span>}
                <button onClick={() => { setPage(n); window.scrollTo({top:0,behavior:'smooth'}); }} style={{minWidth:'38px',padding:'8px 0',borderRadius:'8px',border:n===pageSafe?'none':'1px solid #E2E8F0',background:n===pageSafe?'#F5A623':'#fff',color:n===pageSafe?'#fff':'#1a1a1a',fontWeight:'700',cursor:'pointer'}}>{n}</button>
              </span>
            ))}
            <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({top:0,behavior:'smooth'}); }} disabled={pageSafe >= totalPages} style={{padding:'8px 12px',borderRadius:'8px',border:'1px solid #E2E8F0',background:'#fff',color:pageSafe>=totalPages?'#ccc':'#1a1a1a',cursor:pageSafe>=totalPages?'default':'pointer',fontWeight:'700'}}>→</button>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  )
}
