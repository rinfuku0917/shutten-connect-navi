'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

type DbMessage = { id: string, application_id: string, sender_id: string, body: string, sent_at: string }

const applies = [
  { id: '1', place: '日本体育大学医療専門学校', area: '東京', date: '6月3日（水）', time: '11:00〜16:00', type: 'キッチンカー', plan: '日額固定 5,000円', status: '承認済', statusColor: '#16A34A', statusBg: '#ECFDF5' },
  { id: '2', place: '大阪公立大学りんくうキャンパス', area: '大阪', date: '7月2日（水）', time: '11:00〜14:00', type: 'キッチンカー', plan: '日額固定 4,000円', status: '審査中', statusColor: '#92400E', statusBg: '#FEF3C7' },
  { id: '3', place: 'イオンモール富谷', area: '宮城', date: '6月14日（土）', time: '10:00〜18:00', type: 'キッチンカー・物販', plan: '売上15%', status: '否認', statusColor: '#DC2626', statusBg: '#FEE2E2' },
  { id: '4', place: '横浜みなとみらいマルシェ', area: '神奈川', date: '6月21日（土）', time: '10:00〜17:00', type: '物販・飲食', plan: '日額固定 6,000円', status: '審査中', statusColor: '#92400E', statusBg: '#FEF3C7' },
]

const messages = [
  { id: '1', from: '渋谷マルシェ実行委員会', msg: '書類の確認が完了しました。当日よろしくお願いします！', time: '14:32', unread: true },
  { id: '2', from: '管理者（出店コネクトナビ）', msg: '書類提出ありがとうございます。審査中です。', time: '昨日', unread: false },
  { id: '3', from: 'イオンモール富谷', msg: '今回はご応募いただきありがとうございました。', time: '2日前', unread: false },
]

const calDates = [
  { date: '6/3', day: '水', status: '承認済', place: '日体大医療', color: '#ECFDF5', border: '#86EFAC', text: '#16A34A' },
  { date: '6/7', day: '土', status: '申込可', place: '', color: '#FFF8E1', border: '#FCD34D', text: '#92400E' },
  { date: '6/8', day: '日', status: '申込可', place: '', color: '#FFF8E1', border: '#FCD34D', text: '#92400E' },
  { date: '6/14', day: '土', status: '否認', place: 'イオンモール', color: '#FEE2E2', border: '#FCA5A5', text: '#DC2626' },
  { date: '6/21', day: '土', status: '審査中', place: 'みなとみらい', color: '#FEF3C7', border: '#FCD34D', text: '#92400E' },
  { date: '6/28', day: '土', status: '申込可', place: '', color: '#FFF8E1', border: '#FCD34D', text: '#92400E' },
]

const docs = [
  { name: '運転免許証（表面）', required: true, status: '承認済', icon: '🪪' },
  { name: '運転免許証（裏面）', required: true, status: '承認済', icon: '🪪' },
  { name: '食品衛生責任者証', required: true, status: '審査中', icon: '📄' },
  { name: '損害賠償保険証書', required: true, status: '未提出', icon: '🛡️' },
  { name: 'その他許可証', required: false, status: '未提出', icon: '📋' },
]

export default function SellerDashboard() {
  type TabKey = 'home'|'applies'|'calendar'|'messages'|'docs'|'profile'
  const validTabs: TabKey[] = ['home','applies','calendar','messages','docs','profile']
  const getInitialTab = (): TabKey => {
    if (typeof window === 'undefined') return 'home'
    const t = new URLSearchParams(window.location.search).get('tab')
    return (t && validTabs.includes(t as TabKey)) ? (t as TabKey) : 'home'
  }
  const [tab, setTab] = useState<TabKey>(getInitialTab())
  const [chatOpen, setChatOpen] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string|null>(null)
  const [appId, setAppId] = useState<string|null>(null)

  // ログイン中ユーザーの最初の申込に紐づくメッセージを読み込む
  const loadMessages = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setMyId(uid)
    const { data: apps } = await supabase
      .from('applications')
      .select('id')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
    const firstAppId = apps?.[0]?.id
    if (!firstAppId) return
    setAppId(firstAppId)
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at')
      .eq('application_id', firstAppId)
      .order('sent_at', { ascending: true })
    if (msgs) setDbMessages(msgs as DbMessage[])
  }

  // タブが変わったらURLの ?tab= を更新（リロードしても同じタブを保つ）
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url.toString())
  }, [tab])

  useEffect(() => {
    if (tab === 'messages') loadMessages()
  }, [tab])

  // メッセージを送信する
  const sendMessage = async () => {
    const text = msg.trim()
    if (!text || !appId || !myId) return
    const { error } = await supabase
      .from('messages')
      .insert({ application_id: appId, sender_id: myId, body: text })
    if (error) { alert('送信に失敗しました: ' + error.message); return }
    setMsg('')
    loadMessages()
  }

  const navItems = [
    { key: 'home', icon: '🏠', label: 'ホーム' },
    { key: 'applies', icon: '📋', label: '申込一覧' },
    { key: 'calendar', icon: '📅', label: 'カレンダー' },
    { key: 'messages', icon: '💬', label: 'メッセージ', badge: 1 },
    { key: 'docs', icon: '📁', label: '書類管理' },
    { key: 'profile', icon: '👤', label: 'プロフィール' },
  ]

  return (
    <div className='admin-shell' style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex' }}>
      {/* サイドバー */}
      <div className='admin-sidebar' style={{ width: '200px', background: '#1E2A3B', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className='admin-sidebar-head' style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '12px', padding: '3px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>出店</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>コネクトナビ</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>出店者ダッシュボード</div>
        </div>
        <div className='admin-sidebar-head' style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', color: '#fff', flexShrink: 0 }}>山</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>山田 花子</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Hana's Sweets</div>
            </div>
          </div>
        </div>
        <nav className='admin-sidebar-nav' style={{ padding: '8px 0', flex: 1 }}>
          {navItems.map(item => (
            <div key={item.key} onClick={() => setTab(item.key as typeof tab)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', color: tab === item.key ? '#fff' : 'rgba(255,255,255,0.6)', background: tab === item.key ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: tab === item.key ? '3px solid #F5A623' : '3px solid transparent', fontSize: '13px', position: 'relative' }}>
              <span>{item.icon}</span>{item.label}
              {item.badge && <span style={{ marginLeft: 'auto', background: '#DC2626', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: '700', padding: '1px 6px' }}>{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div className='admin-sidebar-back' style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textDecoration: 'none' }}>← サイトに戻る</Link>
        </div>
      </div>

      {/* メイン */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 24px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>
            {tab === 'home' && 'ダッシュボード'}
            {tab === 'applies' && '申込一覧'}
            {tab === 'calendar' && '出店カレンダー'}
            {tab === 'messages' && 'メッセージ'}
            {tab === 'docs' && '書類管理'}
            {tab === 'profile' && 'プロフィール'}
          </div>
          <Link href="/places" style={{ background: '#F5A623', color: '#fff', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', textDecoration: 'none' }}>＋ 新しい案件を探す</Link>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

          {/* ホーム */}
          {tab === 'home' && (
            <>
              <div className='admin-stats' style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: '申込中', value: '2件', icon: '⏳', color: '#92400E', bg: '#FEF3C7' },
                  { label: '承認済（今月）', value: '1件', icon: '✅', color: '#16A34A', bg: '#ECFDF5' },
                  { label: '出店予定日', value: '3日', icon: '📅', color: '#1D4ED8', bg: '#EBF6FD' },
                  { label: '未読メッセージ', value: '1件', icon: '💬', color: '#DC2626', bg: '#FEE2E2' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{s.icon}</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: s.color }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>📋 最近の申込</div>
                    <button onClick={() => setTab('applies')} style={{ background: 'none', border: 'none', color: '#3A9BD5', fontSize: '12px', cursor: 'pointer' }}>すべて見る</button>
                  </div>
                  {applies.slice(0,3).map((a,i) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 18px', borderBottom: i<2 ? '1px solid #F1F5F9' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>{a.place}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{a.date} ／ {a.plan}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: a.statusBg, color: a.statusColor, flexShrink: 0 }}>{a.status}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>📁 書類提出状況</div>
                    <button onClick={() => setTab('docs')} style={{ background: 'none', border: 'none', color: '#3A9BD5', fontSize: '12px', cursor: 'pointer' }}>管理する</button>
                  </div>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {[{ label: '承認済', count: 2, color: '#16A34A', bg: '#ECFDF5' }, { label: '審査中', count: 1, color: '#92400E', bg: '#FEF3C7' }, { label: '未提出', count: 2, color: '#DC2626', bg: '#FEE2E2' }].map(d => (
                        <div key={d.label} style={{ flex: 1, background: d.bg, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: d.color }}>{d.count}</div>
                          <div style={{ fontSize: '10px', color: d.color }}>{d.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#FEE2E2', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#DC2626', display: 'flex', gap: '6px' }}>
                      <span>⚠️</span>
                      <span>損害賠償保険証書が未提出です。出店前に提出してください。</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 申込一覧 */}
          {tab === 'applies' && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['すべて', '審査中', '承認済', '否認'].map((f, i) => (
                  <button key={f} style={{ padding: '6px 16px', borderRadius: '999px', border: '1.5px solid', borderColor: i === 0 ? '#F5A623' : '#E2E8F0', background: i === 0 ? '#FFF8E1' : '#fff', color: i === 0 ? '#B45309' : '#64748B', fontSize: '12px', fontWeight: i === 0 ? '700' : '400', cursor: 'pointer' }}>{f}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {applies.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#EBF6FD', color: '#1D4ED8' }}>{a.area}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#F1F5F9', color: '#64748B' }}>{a.type}</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>{a.place}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>📅 {a.date} ／ ⏰ {a.time} ／ 💰 {a.plan}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', background: a.statusBg, color: a.statusColor }}>{a.status}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setTab('messages'); setChatOpen(a.place) }} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>💬 連絡</button>
                        {a.status === '否認' && <button style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #F5A623', borderRadius: '6px', background: '#FFF8E1', color: '#B45309', cursor: 'pointer' }}>再申込</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* カレンダー */}
          {tab === 'calendar' && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[{ label: '承認済', color: '#16A34A', bg: '#ECFDF5' }, { label: '審査中', color: '#92400E', bg: '#FEF3C7' }, { label: '否認', color: '#DC2626', bg: '#FEE2E2' }, { label: '申込可', color: '#92400E', bg: '#FFF8E1' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: l.bg, border: `1px solid ${l.color}` }}></div>
                    {l.label}
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <button style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>‹</button>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>2026年6月</div>
                  <button style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
                  {['日','月','火','水','木','金','土'].map((d,i) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: i===0?'#DC2626':i===6?'#1D4ED8':'#64748B', padding: '6px 0' }}>{d}</div>
                  ))}
                  {Array.from({length:6}).map((_,i) => <div key={i} style={{ minHeight: '60px' }}></div>)}
                  {Array.from({length:30}).map((_,i) => {
                    const d = i+1
                    const found = calDates.find(c => parseInt(c.date.split('/')[1]) === d)
                    const dow = (i+6)%7
                    return (
                      <div key={d} style={{ minHeight: '60px', borderRadius: '8px', border: `1px solid ${found ? found.border : '#E2E8F0'}`, background: found ? found.color : '#fff', padding: '5px', cursor: found?.status === '申込可' ? 'pointer' : 'default' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: dow===0?'#DC2626':dow===6?'#1D4ED8':'#333', marginBottom: '3px' }}>{d}</div>
                        {found && <div style={{ fontSize: '9px', fontWeight: '700', color: found.text, lineHeight: 1.3 }}>{found.status}{found.place && <><br/>{found.place}</>}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => window.location.href='/places'} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>＋ 新しい出店日を申込む</button>
              </div>
            </>
          )}

          {/* メッセージ */}
          {tab === 'messages' && (
            <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '0', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', minHeight: '500px' }}>
              <div style={{ borderRight: '1px solid #E2E8F0' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', background: '#FFF8E1', color: '#B45309' }}>メッセージ</div>
                <div onClick={() => setChatOpen('main')}
                  style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: chatOpen === 'main' ? '#FFF8E1' : '#fff', borderLeft: chatOpen === 'main' ? '3px solid #F5A623' : '3px solid transparent' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a1a' }}>募集者とのやり取り</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>{dbMessages.length > 0 ? dbMessages[dbMessages.length-1].body : 'メッセージはまだありません'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chatOpen ? (
                  <>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>募集者とのやり取り</div>
                    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC' }}>
                      {dbMessages.length === 0 ? (
                        <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>まだメッセージがありません</div>
                      ) : dbMessages.map(m => (
                        m.sender_id === myId ? (
                          <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
                            <div style={{ background: '#F5A623', color: '#fff', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6 }}>{m.body}</div>
                          </div>
                        ) : (
                          <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: '#1a1a1a' }}>{m.body}</div>
                          </div>
                        )
                      ))}
                    </div>
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                      <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} placeholder="メッセージを入力..." style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a' }} />
                      <button onClick={sendMessage} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>送信</button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '14px' }}>メッセージを選択してください</div>
                )}
              </div>
            </div>
          )}

          {/* 書類管理 */}
          {tab === 'docs' && (
            <>
              <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#DC2626', display: 'flex', gap: '8px' }}>
                <span>⚠️</span><span>損害賠償保険証書が未提出です。出店前に必ず提出してください。</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {docs.map(doc => (
                  <div key={doc.name} style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${doc.status === '承認済' ? '#86EFAC' : doc.status === '審査中' ? '#FCD34D' : '#E2E8F0'}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '28px' }}>{doc.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '3px' }}>{doc.name} {doc.required && <span style={{ fontSize: '10px', color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: '3px', marginLeft: '4px' }}>必須</span>}</div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: doc.status === '承認済' ? '#ECFDF5' : doc.status === '審査中' ? '#FEF3C7' : '#F1F5F9', color: doc.status === '承認済' ? '#16A34A' : doc.status === '審査中' ? '#92400E' : '#64748B', flexShrink: 0 }}>{doc.status}</span>
                    {doc.status === '未提出' && (
                      <button style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}>📎 アップロード</button>
                    )}
                    {doc.status === '承認済' && (
                      <button style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>👁️ 確認</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* プロフィール */}
          {tab === 'profile' && (
            <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>👤 基本情報</div>
                {[
                  { label: '氏名', value: '山田 花子' },
                  { label: '店舗名', value: "Hana's Sweets" },
                  { label: 'メール', value: 'hanako@example.com' },
                  { label: '電話番号', value: '090-1234-5678' },
                  { label: 'ジャンル', value: '焼き菓子・スイーツ' },
                  { label: '活動エリア', value: '東京都・神奈川県' },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ width: '100px', fontSize: '12px', color: '#64748B', flexShrink: 0 }}>{f.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500' }}>{f.value}</div>
                  </div>
                ))}
                <button style={{ marginTop: '16px', width: '100%', background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>✏️ 編集する</button>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>📱 SNS・メディア</div>
                {[
                  { label: 'Instagram', value: '@hana_sweets', icon: '📸' },
                  { label: 'X（Twitter）', value: '@hana_sweets_jp', icon: '🐦' },
                  { label: 'YouTube', value: '未設定', icon: '▶️' },
                  { label: 'TikTok', value: '未設定', icon: '🎵' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '18px' }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{s.label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: s.value === '未設定' ? '#94A3B8' : '#1D4ED8' }}>{s.value}</div>
                    </div>
                    <button style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>編集</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
