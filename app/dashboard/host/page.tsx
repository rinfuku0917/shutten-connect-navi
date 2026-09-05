'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import MeetingRequestForm from '../../components/MeetingRequestForm'
import { exportPlaceSubmission } from '../../lib/submissionXlsx'
import { exportPlaceSalesReport } from '../../lib/salesReportXlsx'
import ClosedToggle from '../../components/ClosedToggle'
import DuplicateButton from '../../components/DuplicateButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import Notice from '../../components/Notice'
import NotifyChoice from '../../components/NotifyChoice'

type Place = {
  id: string
  title: string
  prefecture: string | null
  status: string | null
  closed?: boolean | null
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
  // 確認とお知らせを画面の中に出す。
  // window.confirm / alert はアプリ内ブラウザ（LINE など）で黙って無視され、
  // 押しても何も起きないように見える。管理画面と同じ作りにそろえる
  const [askState, setAskState] = useState<{ title: string; body?: string; okLabel?: string; danger?: boolean; resolve: (ok: boolean) => void } | null>(null)
  const ask = (o: { title: string; body?: string; okLabel?: string; danger?: boolean }) =>
    new Promise<boolean>(resolve => setAskState({ ...o, resolve }))
  const answerAsk = (ok: boolean) => { askState?.resolve(ok); setAskState(null) }
  const [notice, setNotice] = useState<{ message: string; kind: 'error' | 'ok' | 'info' } | null>(null)
  const showNotice = (message: string, kind: 'error' | 'ok' | 'info' = 'error') => setNotice({ message, kind })
  const [places, setPlaces] = useState<Place[]>([])
  const [apps, setApps] = useState<HostApp[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [xlsxBusy, setXlsxBusy] = useState('')
  const [repBusy, setRepBusy] = useState('')

  // 売上報告（品目ごとの販売食数を含む）のExcel
  const downloadSalesReportXlsx = async (placeId: string, title: string) => {
    setRepBusy(placeId)
    try {
      const n = await exportPlaceSalesReport(supabase, placeId, title)
      if (n === 0) showNotice('この案件には、まだ売上の報告がありません', 'info')
    } catch (e) {
      showNotice(e instanceof Error ? e.message : '出力に失敗しました')
    }
    setRepBusy('')
  }

  // 施設・企業へ提出する「出店者情報」Excel。
  // 承認済みの出店者を、開催日ごとのシートにまとめてダウンロードする。
  const downloadSubmitXlsx = async (placeId: string, title: string) => {
    setXlsxBusy(placeId)
    try {
      const n = await exportPlaceSubmission(supabase, placeId, title)
      if (n === 0) showNotice('この案件には、出店日が入った承認済みの申込がまだありません', 'info')
    } catch (e) {
      showNotice(e instanceof Error ? e.message : '出力に失敗しました')
    }
    setXlsxBusy('')
  }

  // ===== 打ち合わせのご相談 =====
  // 掲載する前に「そもそも可能性があるか」を相談したいという要望が多いため、
  // 相談フォーム（共通部品）を開けるようにする。
  const [meetingOpen, setMeetingOpen] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('places')
      .select('id,title,prefecture,status,pinned,closed,created_at')
      .eq('host_id', user.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setPlaces(data || [])

    // 自分の場所への申込を取得
    const placeIds = (data || []).map(p => p.id)
    if (placeIds.length > 0) {
      const { data: appData } = await supabase
        .from('applications')
        .select('id,apply_date,format,status,place_id,seller_id,places(title)')
        .in('place_id', placeIds)
        .order('created_at', { ascending: false })

      // 出店者の名前は public_sellers から引く。
      //
      // 以前は profiles(name,shop_name) を一緒に取っていたが、
      // 2026-09-02 に profiles の閲覧を「自分の行と管理者だけ」に絞ったため、
      // 募集者からは他人の profiles が読めなくなり、応募者が全員
      // 「(出店者)」と表示されるようになっていた。
      // public_sellers は公開してよい項目だけを出すビューなので、こちらを使う。
      const sellerIds = [...new Set((appData || []).map((a: any) => a.seller_id).filter(Boolean))]
      const nameById = new Map<string, string>()
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('public_sellers').select('id, shop_name, name').in('id', sellerIds)
        for (const s of sellers || []) nameById.set(s.id, s.shop_name || s.name || '')
      }

      const mapped: HostApp[] = (appData || []).map((a: any) => ({
        id: a.id,
        placeTitle: a.places?.title || '(案件名なし)',
        sellerName: nameById.get(a.seller_id) || '(出店者)',
        date: a.apply_date || '日付未定',
        format: a.format || '-',
        status: a.status || 'pending',
      }))
      setApps(mapped)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // 不採用は出店者にメールが届くので、必ず確認をはさむ。
  // window.confirm はスマホのアプリ内ブラウザで無視されることがあるため使わない。
  const [rejectAsk, setRejectAsk] = useState<{ id: string; seller: string; place: string; status: 'approved' | 'rejected' } | null>(null)
  const [notify, setNotify] = useState(true)
  const [rejectBusy, setRejectBusy] = useState(false)
  const [rejectErr, setRejectErr] = useState<string | null>(null)

  // notify=false のときは、状態だけ変えてメールは送らない
  const decide = async (id: string, status: 'approved' | 'rejected', notify = true) => {
    await supabase.from('applications').update({ status }).eq('id', id)
    // 出店者へステータス通知（失敗しても処理は継続）
    if (notify) try {
      await fetch('/api/notify/application-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id, status }),
      })
    } catch (e) {
      console.error('ステータス通知に失敗しました', e)
    }
    showToast(status === 'approved' ? '承認しました' : '不採用にしました')
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
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button onClick={() => setMeetingOpen(true)} style={{background:'#fff',color:'#1D4ED8',border:'1.5px solid #BFDBFE',fontWeight:'900',fontSize:'14px',padding:'10px 18px',borderRadius:'8px',cursor:'pointer'}}>打ち合わせを相談する</button>
            <Link href='/dashboard/host/new-place' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'10px 20px',borderRadius:'8px',textDecoration:'none'}}>+ 新規登録</Link>
          </div>
        </div>
        {meetingOpen && (
          <div style={{background:'#fff',border:'2px solid #BFDBFE',borderRadius:'12px',padding:'20px',marginBottom:'24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
              <div style={{fontWeight:'900',fontSize:'15px',color:'#1D4ED8'}}>打ち合わせのご相談</div>
              <button onClick={() => setMeetingOpen(false)} style={{background:'none',border:'none',color:'#94A3B8',fontSize:'13px',cursor:'pointer'}}>閉じる ✕</button>
            </div>
            <MeetingRequestForm source='dashboard' onClose={() => setMeetingOpen(false)} />
          </div>
        )}

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
                {place.closed && <span style={{color:'#9CA3AF',fontWeight:700}}>募集終了</span>}
                <span>登録：{fmtDate(place.created_at)}</span>
              </div>
              <div style={{display:'flex',gap:'6px',flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end',marginTop:'8px'}}>
                <Link href={'/dashboard/host/edit-place/' + place.id} style={{background:'#EBF6FD',color:'#1D4ED8',border:'1px solid #BFDBFE',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer',textDecoration:'none'}}>編集</Link>
                <DuplicateButton placeId={place.id} />
                <button onClick={() => downloadSubmitXlsx(place.id, place.title)} disabled={xlsxBusy === place.id} title='承認済みの出店者の情報（店舗名・メニューなど）を日付ごとのシートにまとめたExcelを保存します' style={{background:'#fff',color:'#1D4ED8',border:'1px solid #BFDBFE',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:xlsxBusy === place.id ? 'wait' : 'pointer'}}>{xlsxBusy === place.id ? '作成中…' : '出店者情報Excel'}</button>
                <button onClick={() => downloadSalesReportXlsx(place.id, place.title)} disabled={repBusy === place.id} title='報告された売上と、品目ごとの販売食数をまとめたExcelを保存します' style={{background:'#F0FDF4',color:'#15803D',border:'1px solid #BBF7D0',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:repBusy === place.id ? 'wait' : 'pointer'}}>{repBusy === place.id ? '作成中…' : '売上報告Excel'}</button>
                <ClosedToggle placeId={place.id} closed={!!place.closed} compact />
                <button onClick={() => togglePin(place.id, place.pinned)} style={{background:place.pinned ? '#FFF8E1' : '#f6f6f6',color:place.pinned ? '#E08A00' : '#555',border:place.pinned ? '1px solid #FFD54F' : '1px solid #e0e0e0',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{place.pinned ? '上位解除' : '上位表示'}</button>
                <button onClick={() => toggleStatus(place.id, place.status)} style={{background:place.status === 'published' ? '#FFF3E0' : '#E8F5E9',color:place.status === 'published' ? '#E65100' : '#2E7D32',border:'none',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{place.status === 'published' ? '非公開にする' : '公開する'}</button>
                <button onClick={async () => { if (await ask({ title: 'この案件を削除しますか？', body: 'この操作は取り消せません。', okLabel: '削除する', danger: true })) deletePlace(place.id) }} style={{background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:'6px',padding:'7px 12px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>削除</button>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* 届いた出店申込 */}
        <div style={{marginTop:'32px'}}>
          <h2 style={{fontSize:'18px',fontWeight:'900',color:'#1a1a1a',marginBottom:'4px'}}>届いた出店申込</h2>
          <p style={{fontSize:'13px',color:'#888',marginBottom:'16px'}}>あなたの案件への出店申込を、承認または不採用にできます。どちらも出店者にメールでお知らせが届きます。</p>
          {apps.length === 0 ? (
            <div style={{textAlign:'center',color:'#999',padding:'32px',fontSize:'14px',background:'#fff',border:'1px solid #e0e0e0',borderRadius:'8px'}}>まだ申込はありません。</div>
          ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {apps.map(a => {
              const st = a.status === 'approved' ? {label:'承認済',c:'#16A34A',bg:'#ECFDF5'} : a.status === 'rejected' ? {label:'不採用',c:'#DC2626',bg:'#FEE2E2'} : a.status === 'cancelled' ? {label:'取消し',c:'#475569',bg:'#F1F5F9'} : {label:'審査中',c:'#92400E',bg:'#FEF3C7'}
              return (
              <div key={a.id} style={{background:'#fff',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px',flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:'180px'}}>
                    <div style={{fontSize:'15px',fontWeight:'700',color:'#1a1a1a',marginBottom:'4px'}}>{a.sellerName}</div>
                    <div style={{display:'flex',gap:'12px',fontSize:'12px',color:'#999',flexWrap:'wrap'}}>
                      <span>案件：{a.placeTitle}</span>
                      <span>{a.date}</span>
                      <span>{a.format}</span>
                    </div>
                  </div>
                  <span style={{fontSize:'11px',fontWeight:'700',padding:'4px 12px',borderRadius:'20px',background:st.bg,color:st.c,flexShrink:0}}>{st.label}</span>
                </div>
                {a.status === 'pending' && (
                  <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'12px'}}>
                    <button type='button' onClick={() => { setRejectErr(null); setNotify(true); setRejectAsk({ id: a.id, seller: a.sellerName, place: a.placeTitle, status: 'approved' }) }} style={{background:'#E8F5E9',color:'#2E7D32',border:'1px solid #A5D6A7',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:'700',cursor:'pointer',minHeight:'40px'}}>承認</button>
                    <button type='button' onClick={() => { setRejectErr(null); setNotify(true); setRejectAsk({ id: a.id, seller: a.sellerName, place: a.placeTitle, status: 'rejected' }) }} style={{background:'#FEF2F2',color:'#DC2626',border:'1px solid #FECACA',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:'700',cursor:'pointer',minHeight:'40px'}}>不採用</button>
                  </div>
                )}
              </div>
              )
            })}
          </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!rejectAsk}
        busy={rejectBusy}
        error={rejectErr}
        danger={rejectAsk?.status === 'rejected'}
        title={rejectAsk?.status === 'approved' ? 'この申込を承認しますか？' : 'この申込を不採用にしますか？'}
        body={
          rejectAsk
            ? `${rejectAsk.seller}／${rejectAsk.place}\n\n` +
              (rejectAsk.status === 'approved'
                ? '承認するとマッチングが成立します。'
                : '不採用にすると、この申込は取り消されます。')
            : ''
        }
        extra={
          rejectAsk ? <NotifyChoice checked={notify} onChange={setNotify} disabled={rejectBusy} approved={rejectAsk.status === 'approved'} /> : null
        }
        okLabel={rejectAsk?.status === 'approved' ? '承認する' : '不採用にする'}
        onOk={async () => {
          if (!rejectAsk) return
          setRejectBusy(true)
          setRejectErr(null)
          try {
            await decide(rejectAsk.id, rejectAsk.status, notify)
            setRejectAsk(null)
          } catch {
            setRejectErr('変更できませんでした。もう一度お試しください。')
          } finally {
            setRejectBusy(false)
          }
        }}
        onCancel={() => { if (!rejectBusy) { setRejectAsk(null); setRejectErr(null) } }}
      />
      <Notice message={notice?.message ?? null} kind={notice?.kind} onClose={() => setNotice(null)} />
      <ConfirmDialog
        open={!!askState}
        title={askState?.title || ''}
        body={askState?.body}
        okLabel={askState?.okLabel}
        danger={askState?.danger}
        onOk={() => answerAsk(true)}
        onCancel={() => answerAsk(false)}
      />
    </div>
  )
}
