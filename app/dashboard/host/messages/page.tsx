'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

type DbMessage = { id: string, application_id: string, sender_id: string | null, body: string, sent_at: string, file_url?: string | null }

export default function HostMessages() {
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string|null>(null)
  const [appId, setAppId] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [msgFile, setMsgFile] = useState<File | null>(null)
  const [msgUploading, setMsgUploading] = useState(false)

  const loadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)
    const { data: places } = await supabase
      .from('places').select('id').eq('host_id', user.id)
    const placeIds = (places || []).map(p => p.id)
    if (placeIds.length === 0) { setDbMessages([]); setAppId(null); return }
    const { data: apps } = await supabase
      .from('applications').select('id')
      .in('place_id', placeIds)
      .order('created_at', { ascending: false }).limit(1)
    const firstAppId = apps && apps[0] ? apps[0].id : null
    setAppId(firstAppId)
    if (!firstAppId) { setDbMessages([]); return }
    const { data: messages } = await supabase
      .from('messages').select('id, application_id, sender_id, body, sent_at, file_url')
      .eq('application_id', firstAppId).order('sent_at', { ascending: true })
    setDbMessages(messages || [])
  }

  useEffect(() => { loadMessages(); setChatOpen(true) }, [])

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

  const sendMessage = async () => {
    const text = msg.trim()
    if ((!text && !msgFile) || !appId || !myId) return
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
    loadMessages()
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a1a', margin: 0 }}>メッセージ</h1>
      </div>
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', minHeight: '520px', overflow: 'hidden' }}>
        <div style={{ width: '260px', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', color: '#F5A623', background: '#FFF8E1' }}>メッセージ</div>
          <div onClick={() => setChatOpen(true)}
            style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: chatOpen ? '#FFF8E1' : '#fff', borderLeft: chatOpen ? '3px solid #F5A623' : '3px solid transparent' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>出店者とのやり取り</div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dbMessages.length > 0 ? dbMessages[dbMessages.length - 1].body : 'メッセージはまだありません'}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {chatOpen ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', color: '#1a1a1a' }}>出店者とのやり取り</div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dbMessages.length === 0 ? (
                  <div style={{ color: '#94A3B8', textAlign: 'center', marginTop: '40px' }}>まだメッセージがありません</div>
                ) : dbMessages.map(m => {
                  const mine = m.sender_id === myId
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ background: mine ? '#F5A623' : '#F1F5F9', color: mine ? '#fff' : '#1a1a1a', padding: '9px 14px', borderRadius: '12px', fontSize: '13px' }}>
                        {m.body && <div>{m.body}</div>}
                        {m.file_url && renderAttachment(m.file_url, mine)}
                      </div>
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
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} placeholder='メッセージを入力...' disabled={msgUploading} style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a' }} />
                <button onClick={sendMessage} disabled={msgUploading} style={{ background: msgUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: msgUploading ? 'not-allowed' : 'pointer' }}>{msgUploading ? '...' : '送信'}</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>メッセージを選択してください</div>
          )}
        </div>
      </div>
    </div>
  )
}
