'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const navItems = [
  { href: '/dashboard/host', label: '場所・案件管理' },
  { href: '/dashboard/host/new-place', label: '新規登録' },
  { href: '/dashboard/host/messages', label: 'メッセージ' },
]

export default function HostSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const [userName, setUserName] = useState('')

  // 自分の場所への申込に届いた未読メッセージ数を数える
  const loadUnread = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data: places } = await supabase.from('places').select('id').eq('host_id', uid)
    const placeIds = (places || []).map(p => p.id)
    if (placeIds.length === 0) { setUnread(0); return }
    const { data: apps } = await supabase.from('applications').select('id').in('place_id', placeIds)
    const appIds = (apps || []).map(a => a.id)
    if (appIds.length === 0) { setUnread(0); return }
    const { data: msgs } = await supabase
      .from('messages').select('id, sender_id, read_at')
      .in('application_id', appIds)
    const cnt = (msgs || []).filter(m => m.sender_id !== uid && !m.read_at).length
    setUnread(cnt)

    // メッセージページを開いているなら既読にする
    if (pathname === '/dashboard/host/messages' && cnt > 0) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() })
        .in('application_id', appIds).neq('sender_id', uid).is('read_at', null)
      setUnread(0)
    }
  }

  // ログイン中の募集者の名前を取得
  const loadUserName = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data: prof } = await supabase.from('profiles').select('name, shop_name').eq('id', uid).single()
    setUserName(prof?.shop_name || prof?.name || '')
  }

  useEffect(() => { loadUnread() }, [pathname])
  useEffect(() => { loadUserName() }, [])

  return (
    <div className='dash-sidebar' style={{ width: '200px', background: '#1E2A3B', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div className='dash-sidebar-head' style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '12px', padding: '3px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>出店</div>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>コネクトナビ</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>募集者ダッシュボード</div>
      </div>
      <div className='dash-sidebar-user' style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', color: '#fff', flexShrink: 0 }}>{userName ? userName.charAt(0) : '・'}</div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{userName || '読み込み中...'}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>募集者</div>
          </div>
        </div>
      </div>
      <nav className='dash-sidebar-nav' style={{ padding: '8px 0', flex: 1 }}>
        {navItems.map(item => {
          const active = pathname === item.href
          const showBadge = item.href === '/dashboard/host/messages' && unread > 0
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', textDecoration: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.6)', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: active ? '3px solid #F5A623' : '3px solid transparent', fontSize: '13px' }}>
              <span>{item.label}</span>
              {showBadge && <span style={{ marginLeft: 'auto', background: '#DC2626', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: '700', padding: '1px 6px' }}>{unread}</span>}
            </Link>
          )
        })}
      </nav>
      <div className='dash-sidebar-back' style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ width: '100%', background: 'transparent', color: '#F5A623', border: '1px solid #F5A623', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>ログアウト</button>
      </div>
    </div>
  )
}
