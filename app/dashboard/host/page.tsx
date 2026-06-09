'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

type Place = {
  id: string
  title: string
  prefecture: string | null
  status: string | null
  pinned: boolean | null
  created_at: string | null
}

type HostApp = {
  id: string
  placeTitle: string
  sellerName: string
  date: string
  format: string
  status: string
}

export default function HostDashboard() {
  const [places, setPlaces] = useState<Place[]>([])
  const [apps, setApps] = useState<HostApp[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('places')
      .select('id,title,prefecture,status,pinned,created_at')
      .eq('host_id', user.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setPlaces(data || [])

    // 自分の場所への申込を取得
    const placeIds = (data || []).map(p => p.id)
    if (placeIds.length > 0) {
      const { data: appData } = await supabase
        .from('applications')
        .select('id,apply_date,format,status,place_id,seller_id,places(title),profiles(name,shop_name)')
        .in('place_id', placeIds)
        .order('created_at', { ascending: false })
      const mapped: HostApp[] = (appData || []).map((a: any) => ({
        id: a.id,
        placeTitle: a.places?.title || '(案件名なし)',
        sellerName: a.profiles?.shop_name || a.profiles?.name || '(出店者)',
        date: a.apply_date || '日付未定',
        format: a.format || '-',
        status: a.status || 'pending',
      }))
      setApps(mapped)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('applications').update({ status }).eq('id', id)
    showToast(status === 'approved' ? '承認しました' : '否認しました')
    load()
  }

  const togglePin = async (id: string, cur: boolean | null) => {
    await supabase.from('places').update({ pinned: !cur }).eq('id', id)
    showToast('ピン留めを更新しました')
    load()
  }

  const toggleStatus = async (id: string, cur: string | null) => {
    const next = cur === 'published' ? 'draft' : 'published'
    await supabase.from('places').update({ status: next }).eq('id', id)
    showToast('公開状態を変更しました')
    load()
  }

  const deletePlace = async (id: string) => {
    await supabase.from('places').delete().eq('id', id)
    showToast('削除しました')
    load()
  }

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ja-JP') : '-'

  return (
    <div>
      {toast && <div style={{position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',color:'#fff',padding:'12px 24px',borderRadius:'8px',zIndex:1000,fontSize:'14px',fontWeight:'600',boxShadow:'0 4px 12px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>{toast}</div>}
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'32px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:'900',color:'#1a1a1a',marginBottom:'4px'}}>場所・案件管理</h1>
            <p style={{fontSize:'13px',color:'#888'}}>案件の公開・非公開・上位表示を管理できます</p>
          </div>
          <Link href='/dashboard/host/new-place' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'10px 20px',borderRadius:'8px',textDecoration:'none'}}>+ 新規登録</Link>
        </div>
        <div style={{background:'#FFF8E1',border:'1px solid #FFE082',borderRadius:'8px',padding:'14px 16px',marginBottom:'24px',fontSize:'13px',color:'#B45309'}}>
          上位表示：ピン留めした案件は一覧ページの上位に表示されます（最大3件）。更新ボタンで新着順でも上位に表示できます。
        </div>
        {loading ? (
          <div style={{textAlign:'center',color:'#999',padding:'40px',fontSize:'14px'}}>読み込み中...</div>
        ) : places.length === 0 ? (
          <div style={{textAlign:'center',color:'#999',padding:'40px',fontSize:'14px'}}>まだ案件がありません。「＋ 新規登録」から登録してください。</div>
        ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {places.map(place => (
            <div key={place.id} style={{background:'#fff',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'16px'}}>
              <div style={{fontSize:'15px',fontWeight:'700',color:'#1a1a1a',marginBottom:'6px'}}>{place.title}</div>
              <div style={{display:'flex',gap:'16px',fontSize:'12px',color:'#999',flexWrap:'wrap'}}>
                <span>{place.prefecture || '-'}</span>
                <span>状態：{place.status === 'published' ? '公開中' : '非公開'}</span>
                <span>登録：{fmtDate(place.created_at)}</span>
              </div>
              <div style={{display:'flex',gap:'6px',flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end',marginTop:'8px'}}>
                <Link href={'/dashboard/host/edit-place/' + place.id} style={{background:'#EBF6FD',color:'#1D4ED8',border:'1px solid #BFDBFE',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer',textDecoration:'none'}}>編集</Link>
                <button onClick={() => togglePin(place.id, place.pinned)} style={{background:place.pinned ? '#FFF8E1' : '#f6f6f6',color:place.pinned ? '#E08A00' : '#555',border:place.pinned ? '1px solid #FFD54F' : '1px solid #e0e0e0',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{place.pinned ? '上位解除' : '上位表示'}</button>
                <button onClick={() => toggleStatus(place.id, place.status)} style={{background:place.status === 'published' ? '#FFF3E0' : '#E8F5E9',color:place.status === 'published' ? '#E65100' : '#2E7D32',border:'none',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{place.status === 'published' ? '非公開にする' : '公開する'}</button>
                <button onClick={() => { if(window.confirm('削除しますか？')) deletePlace(place.id) }} style={{background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>削除</button>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* 届いた出店申込 */}
        <div style={{marginTop:'32px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#1a1a1a',marginBottom:'4px'}}>📋 届いた出店申込</h2>
          <p style={{fontSize:'13px',color:'#888',marginBottom:'16px'}}>あなたの案件への出店申込を承認・否認できます</p>
          {apps.length === 0 ? (
            <div style={{textAlign:'center',color:'#999',padding:'32px',fontSize:'14px',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'8px'}}>まだ申込はありません。</div>
          ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {apps.map(a => {
              const st = a.status === 'approved' ? {label:'承認済',c:'#16A34A',bg:'#ECFDF5'} : a.status === 'rejected' ? {label:'否認',c:'#DC2626',bg:'#FEE2E2'} : {label:'審査中',c:'#92400E',bg:'#FEF3C7'}
              return (
              <div key={a.id} style={{background:'#fff',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px',flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:'180px'}}>
                    <div style={{fontSize:'15px',fontWeight:'700',color:'#1a1a1a',marginBottom:'4px'}}>{a.sellerName}</div>
                    <div style={{display:'flex',gap:'12px',fontSize:'12px',color:'#999',flexWrap:'wrap'}}>
                      <span>案件：{a.placeTitle}</span>
                      <span>📅 {a.date}</span>
                      <span>{a.format}</span>
                    </div>
                  </div>
                  <span style={{fontSize:'11px',fontWeight:'700',padding:'4px 12px',borderRadius:'20px',background:st.bg,color:st.c,flexShrink:0}}>{st.label}</span>
                </div>
                {a.status === 'pending' && (
                  <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'12px'}}>
                    <button onClick={() => decide(a.id, 'approved')} style={{background:'#E8F5E9',color:'#2E7D32',border:'1px solid #A5D6A7',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>承認</button>
                    <button onClick={() => { if(window.confirm('この申込を否認しますか？')) decide(a.id, 'rejected') }} style={{background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>否認</button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
