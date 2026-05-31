'use client'
import Link from 'next/link'
import { useState } from 'react'

const allPlaces = [
  {id:'1',img:'🏫',tag:'常設',area:'東京',title:'日本体育大学医療専門学校（6〜8月スケジュール）',fee:'日額5,000円',time:'11:00〜16:00',type:'キッチンカー',keyword:'大学 学校 東京 世田谷'},
  {id:'2',img:'🏫',tag:'常設',area:'大阪',title:'大阪公立大学りんくうキャンパス（7月募集）',fee:'無料',time:'11:00〜14:00',type:'キッチンカー',keyword:'大学 学校 大阪'},
  {id:'3',img:'🏬',tag:'常設',area:'宮城',title:'イオンモール富谷',fee:'要相談',time:'10:00〜18:00',type:'キッチンカー・物販',keyword:'ショッピング モール 宮城'},
  {id:'4',img:'🏫',tag:'常設',area:'東京',title:'町田美容専門学校',fee:'日額3,000円',time:'11:00〜15:00',type:'キッチンカー',keyword:'専門学校 東京 町田'},
  {id:'5',img:'🏢',tag:'常設',area:'福岡',title:'福岡天神エリア オフィスビル',fee:'無料',time:'11:00〜14:00',type:'キッチンカー',keyword:'オフィス ビジネス 福岡 天神'},
  {id:'6',img:'🌳',tag:'イベント',area:'神奈川',title:'横浜みなとみらい 週末マルシェ',fee:'日額8,000円',time:'10:00〜17:00',type:'テント・物販',keyword:'マルシェ 週末 横浜 神奈川'},
  {id:'7',img:'🏫',tag:'常設',area:'愛知',title:'名古屋大学 東山キャンパス',fee:'無料',time:'11:00〜14:00',type:'キッチンカー',keyword:'大学 名古屋 愛知'},
  {id:'8',img:'🌳',tag:'イベント',area:'北海道',title:'札幌大通公園 夏祭りイベント',fee:'日額10,000円',time:'10:00〜20:00',type:'キッチンカー・テント',keyword:'イベント 祭り 札幌 北海道'},
]

const areas = ['すべて','東京','大阪','福岡','神奈川','宮城','愛知','北海道']
const types = ['すべて','キッチンカー','テント','物販','飲食・物販']
const tags = ['すべて','常設','イベント']
const fees = ['すべて','無料','日額5,000円以下','日額10,000円以下','要相談']

export default function PlacesPage() {
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('すべて')
  const [type, setType] = useState('すべて')
  const [tag, setTag] = useState('すべて')
  const [fee, setFee] = useState('すべて')

  const filtered = allPlaces.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !search || p.title.toLowerCase().includes(q) || p.keyword.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
    const matchArea = area === 'すべて' || p.area === area
    const matchType = type === 'すべて' || p.type.includes(type)
    const matchTag = tag === 'すべて' || p.tag === tag
    const matchFee = fee === 'すべて' ||
      (fee === '無料' && p.fee === '無料') ||
      (fee === '要相談' && p.fee === '要相談') ||
      (fee === '日額5,000円以下' && (p.fee === '無料' || p.fee.includes('3,000') || p.fee.includes('5,000'))) ||
      (fee === '日額10,000円以下' && p.fee !== '要相談')
    return matchSearch && matchArea && matchType && matchTag && matchFee
  })

  const reset = () => { setSearch(''); setArea('すべて'); setType('すべて'); setTag('すべて'); setFee('すべて') }
  const isFiltered = search || area !== 'すべて' || type !== 'すべて' || tag !== 'すべて' || fee !== 'すべて'

  const selStyle = {border:'1px solid #e0e0e0',borderRadius:'6px',padding:'7px 12px',fontSize:'13px',background:'#fff',cursor:'pointer',color:'#333'}

  return (
    <div style={{minHeight:'100vh',background:'#f8f9fa',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      

      <div style={{background:'#fff',borderBottom:'1px solid #e8e8e8',padding:'14px 0',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 20px',display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontSize:'12px',fontWeight:'600',color:'#888'}}>エリア</span>
            <select value={area} onChange={e=>setArea(e.target.value)} style={selStyle}>
              {areas.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontSize:'12px',fontWeight:'600',color:'#888'}}>形態</span>
            <select value={type} onChange={e=>setType(e.target.value)} style={selStyle}>
              {types.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontSize:'12px',fontWeight:'600',color:'#888'}}>種別</span>
            <select value={tag} onChange={e=>setTag(e.target.value)} style={selStyle}>
              {tags.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontSize:'12px',fontWeight:'600',color:'#888'}}>出店料</span>
            <select value={fee} onChange={e=>setFee(e.target.value)} style={selStyle}>
              {fees.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          {isFiltered && (
            <button onClick={reset} style={{background:'#fff',color:'#DC2626',border:'1px solid #FECACA',borderRadius:'6px',padding:'7px 14px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>
              ✕ リセット
            </button>
          )}
          <div style={{marginLeft:'auto',fontSize:'13px',color:'#888'}}>
            <span style={{fontWeight:'900',color:'#1a1a1a',fontSize:'16px'}}>{filtered.length}</span> 件
          </div>
        </div>
      </div>

      {isFiltered && (
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'12px 20px 0',display:'flex',gap:'6px',flexWrap:'wrap'}}>
          {search && <span style={{background:'#FFF3E0',color:'#E65100',fontSize:'12px',padding:'4px 10px',borderRadius:'999px',fontWeight:'600'}}>🔍 {search} <button onClick={()=>setSearch('')} style={{background:'none',border:'none',cursor:'pointer',color:'#E65100',marginLeft:'4px',padding:0}}>✕</button></span>}
          {area !== 'すべて' && <span style={{background:'#E3F2FD',color:'#1565C0',fontSize:'12px',padding:'4px 10px',borderRadius:'999px',fontWeight:'600'}}>📍 {area} <button onClick={()=>setArea('すべて')} style={{background:'none',border:'none',cursor:'pointer',color:'#1565C0',marginLeft:'4px',padding:0}}>✕</button></span>}
          {type !== 'すべて' && <span style={{background:'#F3E5F5',color:'#6A1B9A',fontSize:'12px',padding:'4px 10px',borderRadius:'999px',fontWeight:'600'}}>🚚 {type} <button onClick={()=>setType('すべて')} style={{background:'none',border:'none',cursor:'pointer',color:'#6A1B9A',marginLeft:'4px',padding:0}}>✕</button></span>}
          {tag !== 'すべて' && <span style={{background:'#E8F5E9',color:'#2E7D32',fontSize:'12px',padding:'4px 10px',borderRadius:'999px',fontWeight:'600'}}>🏷 {tag} <button onClick={()=>setTag('すべて')} style={{background:'none',border:'none',cursor:'pointer',color:'#2E7D32',marginLeft:'4px',padding:0}}>✕</button></span>}
          {fee !== 'すべて' && <span style={{background:'#FFF8E1',color:'#F57F17',fontSize:'12px',padding:'4px 10px',borderRadius:'999px',fontWeight:'600'}}>💰 {fee} <button onClick={()=>setFee('すべて')} style={{background:'none',border:'none',cursor:'pointer',color:'#F57F17',marginLeft:'4px',padding:0}}>✕</button></span>}
        </div>
      )}

      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'20px'}}>
        {filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'80px 0',background:'#fff',borderRadius:'12px',border:'1px solid #e8e8e8'}}>
            <div style={{fontSize:'clamp(28px, 6vw, 48px)',marginBottom:'16px'}}>🔍</div>
            <div style={{fontSize:'16px',fontWeight:'700',color:'#1a1a1a',marginBottom:'8px'}}>条件に合う出店場所が見つかりませんでした</div>
            <div style={{fontSize:'13px',color:'#999',marginBottom:'20px'}}>検索条件を変えて試してみてください</div>
            <button onClick={reset} style={{background:'#F5A623',color:'#fff',border:'none',borderRadius:'8px',padding:'10px 28px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>条件をリセット</button>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'12px'}}>
            {filtered.map(place=>(
              <Link key={place.id} href={'/places/'+place.id} style={{textDecoration:'none',color:'inherit'}}>
                <div style={{background:'#fff',borderRadius:'10px',overflow:'hidden',border:'1px solid #e8e8e8',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',transition:'transform 0.15s,box-shadow 0.15s'}}>
                  
                    <div style={{position:'absolute',top:'10px',right:'10px',background:'rgba(0,0,0,0.55)',color:'#fff',fontSize:'10px',padding:'3px 10px',borderRadius:'4px'}}>📍{place.area}</div>
                  </div>
                  <div style={{padding:'14px',background:'linear-gradient(135deg,#FFF8E1,#FFF3C4)'}}>
                    <div style={{fontSize:'13px',fontWeight:'700',color:'#1a1a1a',marginBottom:'6px',lineHeight:1.4,height:'36px',overflow:'hidden'}}>{place.title}</div>
                    <div style={{fontSize:'15px',fontWeight:'900',color:'#1a1a1a',marginBottom:'8px'}}>{place.fee}</div>
                    <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                      <span style={{background:'#f8f9fa',color:'#555',fontSize:'11px',padding:'3px 8px',borderRadius:'4px',border:'1px solid #e8e8e8'}}>⏰ {place.time}</span>
                      <span style={{background:'#EBF6FD',color:'#1565C0',fontSize:'11px',padding:'3px 8px',borderRadius:'4px'}}>🚚 {place.type}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer style={{background:'#1a1a1a',color:'#fff',padding:'32px 20px',marginTop:'24px'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <div style={{fontSize:'11px',color:'#555'}}>© 2026 出店コネクトナビ All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  )
}
