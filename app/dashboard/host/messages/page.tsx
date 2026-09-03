'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import BackButton from '../../../components/BackButton'

type DbMessage = { id: string, application_id: string, sender_id: string | null, body: string, sent_at: string, file_url?: string | null }
// 申込1件＝やり取り1スレッド。どの案件・どの出店者かが分かるようにまとめて持つ
type Thread = { applicationId: string, placeTitle: string, sellerName: string, applyDate: string | null, status: string, lastBody: string, lastAt: string | null }

const STATUS_LABEL: Record<string, { label: string, color: string, bg: string }> = {
  pending: { label: '審査中', color: '#92400E', bg: '#FEF3C7' },
  approved: { label: '承認済', color: '#16A34A', bg: '#ECFDF5' },
  rejected: { label: '否認', color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: '取消し', color: '#475569', bg: '#F1F5F9' },
}

export default function HostMessages() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [appId, setAppId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgFile, setMsgFile] = useState<File | null>(null)
  const [msgUploading, setMsgUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  // 自分が募集している案件への申込を、すべてスレッドとして読み込む
  const loadThreads = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMyId(user.id)

    const { data: places } = await supabase.from('places').select('id, title').eq('host_id', user.id)
    const placeIds = (places || []).map(p => p.id)
    if (placeIds.length === 0) { setThreads([]); setLoading(false); return }
    const titleOf = new Map((places || []).map(p => [p.id, p.title as string]))

    const { data: apps } = await supabase
      .from('applications')
      .select('id, place_id, seller_id, apply_date, status')
      .in('place_id', placeIds)
      .order('apply_date', { ascending: false })
    if (!apps || apps.length === 0) { setThreads([]); setLoading(false); return }

    // 出店者名をまとめて引く
    const sellerIds = Array.from(new Set(apps.map(a => a.seller_id).filter(Boolean)))
    const nameOf = new Map<string, string>()
    if (sellerIds.length > 0) {
      // 出店者の表示名は公開用のビューから引く。
      // profiles には連絡先が入っているため、募集者からは直接読ませない。
      const { data: profs } = await supabase.from('public_sellers').select('id, shop_name, name').in('id', sellerIds)
      for (const p of profs || []) nameOf.set(p.id, p.shop_name || p.name || '（名称未設定）')
    }

    // 各スレッドの最新メッセージ
    const appIds = apps.map(a => a.id)
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, file_url')
      .in('application_id', appIds)
      .order('sent_at', { ascending: true })
    const lastOf = new Map<string, DbMessage>()
    for (const m of (msgs || []) as DbMessage[]) lastOf.set(m.application_id, m)

    const built: Thread[] = apps.map(a => {
      const last = lastOf.get(a.id)
      return {
        applicationId: a.id,
        placeTitle: titleOf.get(a.place_id) || '(案件名なし)',
        sellerName: nameOf.get(a.seller_id) || '出店者',
        applyDate: a.apply_date || null,
        status: a.status,
        lastBody: last ? (last.body || '📎 添付ファイル') : 'メッセージはまだありません',
        lastAt: last ? last.sent_at : null,
      }
    })
    // やり取りがあるスレッドを上に、その中でも新しい順に並べる
    built.sort((x, y) => (y.lastAt || '').localeCompare(x.lastAt || ''))
    setThreads(built)
    setLoading(false)
  }

  const openThread = async (id: string) => {
    setAppId(id)
    const { data } = await supabase
      .from('messages').select('id, application_id, sender_id, body, sent_at, file_url')
      .eq('application_id', id).order('sent_at', { ascending: true })
    setDbMessages((data || []) as DbMessage[])
  }

  useEffect(() => { loadThreads() }, [])

  // 開いている間、相手からの新着を自動で取りに行く
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadThreads()
      if (appId) openThread(appId)
    }, 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId])

  // 別のタブで申込や承認があったときに備え、画面に戻ったら読み直す
  useEffect(() => {
    const reload = () => { if (document.visibilityState === 'visible') loadThreads() }
    document.addEventListener('visibilitychange', reload)
    window.addEventListener('focus', reload)
    return () => {
      document.removeEventListener('visibilitychange', reload)
      window.removeEventListener('focus', reload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 添付ファイルを表示する（画像はインライン、それ以外はリンク）
  const renderAttachment = (filePath: string, isMine: boolean) => {
    const { data } = supabase.storage.from('message-attachments').getPublicUrl(filePath)
    const url = data.publicUrl
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(filePath)
    if (isImage) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '6px' }}>
          <img src={url} alt="添付画像" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', display: 'block' }} />
        </a>
      )
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', textDecoration: 'underline', color: isMine ? '#fff' : '#2563EB' }}>📎 ファイルを開く</a>
    )
  }


  // 自分が送ったメッセージを取り消す（打ち間違いの取り消し用）
  const retractMessage = async (messageId: string) => {
    if (!window.confirm('このメッセージを取り消しますか？\n相手の画面からも削除されます。')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('ログインが必要です'); return }
    const res = await fetch('/api/messages/retract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, requesterId: user.id }),
    })
    const result = await res.json()
    if (!res.ok) { alert('取り消せませんでした: ' + (result.error || '不明なエラー')); return }
    if (appId) openThread(appId)
    loadThreads()
  }

  const sendMessage = async () => {
    const text = msg.trim()
    if (!text && !msgFile) return
    // 送り先が決まっていないまま押されたときは、黙って何もしないのではなく理由を伝える
    if (!appId) { alert('先に左のリストからやり取りする案件を選んでください。'); return }
    if (!myId) { alert('ログイン情報を確認できませんでした。再度ログインしてください。'); return }
    setMsgUploading(true)
    let fileUrl: string | null = null
    if (msgFile) {
      const rawExt = (msgFile.name.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'dat'
      const path = myId + '/msg-' + Date.now() + '.' + ext
      const up = await supabase.storage.from('message-attachments').upload(path, msgFile, { upsert: true })
      if (up.error) { alert('添付に失敗しました: ' + up.error.message); setMsgUploading(false); return }
      fileUrl = path
    }
    const { error } = await supabase
      .from('messages').insert({ application_id: appId, sender_id: myId, body: text, file_url: fileUrl })
    if (error) { alert('送信に失敗しました: ' + error.message); setMsgUploading(false); return }
    // 相手へ新着メッセージ通知（失敗しても送信は成功扱い）
    try {
      await fetch('/api/notify/new-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, senderId: myId }),
      })
    } catch (e) {
      console.error('メッセージ通知に失敗しました', e)
    }
    setMsg('')
    setMsgFile(null)
    setMsgUploading(false)
    openThread(appId)
    loadThreads()
  }

  const current = threads.find(t => t.applicationId === appId) || null

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <BackButton fallback='/dashboard/host' />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a1a', margin: 0 }}>メッセージ</h1>
      </div>
      <div className='admin-two-col' style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: '520px', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid #E2E8F0', minWidth: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', color: '#F5A623', background: '#FFF8E1' }}>申込一覧</div>
          {loading ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: '#999', fontSize: '12px' }}>読み込み中...</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: '#999', fontSize: '12px', lineHeight: 1.8 }}>
              まだ申込がありません。<br />出店者から申込が入ると、ここでやり取りできます。
            </div>
          ) : threads.map(t => {
            const st = STATUS_LABEL[t.status] || { label: t.status, color: '#64748B', bg: '#F1F5F9' }
            const on = appId === t.applicationId
            return (
              <div key={t.applicationId} onClick={() => openThread(t.applicationId)}
                style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: on ? '#FFF8E1' : '#fff', borderLeft: on ? '3px solid #F5A623' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sellerName}</span>
                  <span style={{ background: st.bg, color: st.color, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>{st.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.placeTitle}{t.applyDate ? '（' + t.applyDate.slice(5).replace('-', '/') + '）' : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastBody}</div>
              </div>
            )
          })}
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {current ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', color: '#1a1a1a' }}>
                {current.sellerName}
                <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748B', marginLeft: '8px' }}>{current.placeTitle}</span>
              </div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dbMessages.length === 0 ? (
                  <div style={{ color: '#94A3B8', textAlign: 'center', marginTop: '40px' }}>まだメッセージがありません</div>
                ) : dbMessages.map(m => {
                  const mine = m.sender_id === myId
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ background: mine ? '#F5A623' : '#F1F5F9', color: mine ? '#fff' : '#1a1a1a', padding: '9px 14px', borderRadius: '12px', fontSize: '13px', width: 'fit-content', marginLeft: mine ? 'auto' : undefined, whiteSpace: 'pre-wrap' }}>
                        {m.body && <div>{m.body}</div>}
                        {m.file_url && renderAttachment(m.file_url, mine)}
                      </div>
                      {mine && (
                        <div style={{ textAlign: 'right', marginTop: '3px' }}>
                          <button onClick={() => retractMessage(m.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>送信を取り消す</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {msgFile ? (
                <div style={{ padding: '8px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF7ED' }}>
                  <span style={{ fontSize: '12px', color: '#9A3412', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {msgFile.name}</span>
                  <button onClick={() => setMsgFile(null)} style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>✕</button>
                </div>
              ) : null}
              <div style={{ padding: '12px 16px', borderTop: msgFile ? 'none' : '1px solid #E2E8F0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label htmlFor="host-msg-file-input" style={{ cursor: msgUploading ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: msgUploading ? 0.4 : 1, userSelect: 'none' }}>📎</label>
                <input id="host-msg-file-input" type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={msgUploading} onChange={e => { const file = e.target.files?.[0]; if (file) setMsgFile(file); e.currentTarget.value = '' }} />
                <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} onKeyDown={e => {
                        if (e.key !== 'Enter' || e.shiftKey) return
                        // 日本語変換の確定Enterでは送信しない（変換中は無視する）
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const ne = e.nativeEvent as any
                        if (ne?.isComposing || ne?.keyCode === 229) return
                        // 1回目のEnterは改行。すでに末尾が改行なら2回目とみなして送信する
                        if (msg.endsWith('\n')) { e.preventDefault(); sendMessage() }
                      }} placeholder='メッセージを入力...（Enterで改行／2回続けて押すと送信）' disabled={msgUploading} style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                <button onClick={sendMessage} disabled={msgUploading} style={{ background: msgUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: msgUploading ? 'not-allowed' : 'pointer' }}>{msgUploading ? '...' : '送信'}</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px', textAlign: 'center' }}>
              {threads.length === 0 ? '申込が入るとここに表示されます' : '左のリストから案件を選んでください'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
