'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

type DbMessage = { id: string, application_id: string, sender_id: string | null, body: string, sent_at: string }

export default function HostMessages() {
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string|null>(null)
  const [appId, setAppId] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [chatOpen, setChatOpen] = useState(false)

  // 募集者の場所への申込に紐づくメッセージを読み込む
  const loadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)
    // 自分が募集者(host)として持つ場所への申込を1件取得
    const { data: places } = await supabase
      .from('places').select('id').eq('host_id', user.id)
    const placeIds = (places || []).map(p => p.id)
    let appQuery = supabase.from('applications').select('id').order('created_at', { ascending: false }).limit(1)
    if (placeIds.length > 0) appQuery = appQuery.in('place_id', placeIds)
    const { data: apps } = await appQuery
    const firstAppId = apps && apps[0] ? apps[0].id : null
    setAppId(firstAppId)
    if (!firstAppId) { setDbMessages([]); return }
    const { data: messages } = await supabase
      .from('messages').select('id, application_id, sender_id, body, sent_at')
      .eq('application_id', firstAppId).order('sent_at', { ascending: true })
    setDbMessages(messages || [])
  }

  useEffect(() => { loadMessages(); setChatOpen(true) }, [])

  const sendMessage = async () => {
    const text = msg.trim()
    if (!text || !appId || !myId) return
    const { error } = await supabase
      .from('messages').insert({ application_id: appId, sender_id: myId, body: text })
    if (error) { alert('送信に失敗しました: ' + error.message); return }
    setMsg('')
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
                      <div style={{ background: mine ? '#F5A623' : '#F1F5F9', color: mine ? '#fff' : '#1a1a1a', padding: '9px 14px', borderRadius: '12px', fontSize: '13px' }}>{m.body}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} placeholder='メッセージを入力...' style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a' }} />
                <button onClick={sendMessage} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>送信</button>
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
