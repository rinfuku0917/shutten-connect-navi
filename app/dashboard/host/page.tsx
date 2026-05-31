'use client'
import Link from 'next/link'
import { useState } from 'react'
const initialPlaces = [
  {id:'1',title:'日本体育大学医療専門学校（6〜8月スケジュール）',area:'東京',type:'キッチンカー',status:'published',pinned:true,applications:8,deadline:'2026年8月1日',updatedAt:'2026年5月30日'},
  {id:'2',title:'大阪公立大学りんくうキャンパス（7月募集）',area:'大阪',type:'キッチンカー',status:'published',pinned:false,applications:3,deadline:'2026年6月30日',updatedAt:'2026年5月28日'},
  {id:'3',title:'イオンモール富谷',area:'宮城',type:'キッチンカー・物販',status:'draft',pinned:false,applications:0,deadline:'2026年7月31日',updatedAt:'2026年5月25日'},
  {id:'4',title:'町田美容専門学校',area:'東京',type:'キッチンカー',status:'published',pinned:false,applications:5,deadline:'2026年6月15日',updatedAt:'2026年5月20日'},
]
export default function PlaceManagePage() {
  const [places, setPlaces] = useState(initialPlaces)
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),3000) }
  const toggleStatus = (id: string) => {
    setPlaces(prev => prev.map(p => {
      if(p.id !== id) return p
      const next = p.status === 'published' ? 'draft' : 'published'
      showToast(next === 'published' ? '公開しました' : '非公開にしました')
      return {...p, status: next}
    }))
  }
  const togglePin = (id: string) => {
    setPlaces(prev => {
      const target = prev.find(p=>p.id===id)
      if(!target) return prev
      if(!target.pinned && prev.filter(p=>p.pinned).length >= 3) { showToast('上位表示は最大3件までです'); return prev }
      const updated = prev.map(p => p.id===id ? {...p, pinned:!p.pinned} : p)
      showToast(target.pinned ? '上位表示を解除しました' : '上位表示に設定しました')
      return updated.sort((a,b)=>(a.pinned===b.pinned)?0:a.pinned?-1:1)
    })
  }
  const refreshDate = (id: string) => {
    setPlaces(prev => prev.map(p => p.id===id ? {...p, updatedAt:'2026年5月30日'} : p))
    showToast('更新日時をリセットしました。一覧の上位に表示されます')
  }
  const deletePlace = (id: string) => { setPlaces(prev => prev.filter(p=>p.id!==id)); showToast('案件を削除しました') }
  return (
    <div style={{minHeight:'100vh',background:'#f6f6f6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      {toast && <div style={{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',color:'#fff',padding:'12px 24px',borderRadius:'8px',zIndex:1000,fontSize:'14px',fontWeight:'600',boxShadow:'0 4px 12px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>{toast}</div>}
      
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:'900',color:'#1a1a1a',marginBottom:'4px'}}>場所・案件管理</h1>
            <p style={{fontSize:'13px',color:'#888'}}>案件の公開・非公開・上位表示を管理できます</p>
          </div>
          <Link href='/dashboard/host/new-place' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'10px 20px',borderRadius:'8px',textDecoration:'none'}}>+ 新規登録</Link>
        </div>
        <div style={{background:'#FFF8E1',border:'1px solid #FFE082',borderRadius:'8px',padding:'14px 16px',marginBottom:'24px',fontSize:'13px',color:'#B45309'}}>
          上位表示：ピン留めした案件は一覧ページの上位に表示されます（最大3件）。更新ボタンで新着順でも上位に表示できます。
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {places.map(place=>(
            
                  <div style={{fontSize:'15px',fontWeight:'700',color:'#1a1a1a',marginBottom:'6px'}}>{place.title}</div>
                  <div style={{display:'flex',gap:'16px',fontSize:'12px',color:'#999',flexWrap:'wrap'}}>
                    <span>{place.area}</span>
                    <span>締切：{place.deadline}</span>
                    <span>応募：{place.applications}件</span>
                    <span>更新：{place.updatedAt}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:'6px',flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  <button onClick={()=>togglePin(place.id)} style={{background:place.pinned ? '#FFF8E1' : '#f6f6f6',color:place.pinned ? '#E08A00' : '#555',border:place.pinned ? '1px solid #FFD54F' : '1px solid #e0e0e0',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{place.pinned ? '上位解除' : '上位表示'}</button>
                  <button onClick={()=>refreshDate(place.id)} style={{background:'#f6f6f6',color:'#555',border:'1px solid #e0e0e0',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>更新</button>
                  <button onClick={()=>toggleStatus(place.id)} style={{background:place.status==='published' ? '#FFF3E0' : '#E8F5E9',color:place.status==='published' ? '#E65100' : '#2E7D32',border:'none',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{place.status==='published' ? '非公開にする' : '公開する'}</button>
                  <button onClick={()=>{ if(window.confirm('削除しますか？')) deletePlace(place.id) }} style={{background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>削除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
