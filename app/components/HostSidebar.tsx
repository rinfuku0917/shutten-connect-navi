'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard/host', icon: '📋', label: '場所・案件管理' },
  { href: '/dashboard/host/new-place', icon: '➕', label: '新規登録' },
  { href: '/dashboard/host/messages', icon: '💬', label: 'メッセージ' },
]

export default function HostSidebar() {
  const pathname = usePathname()
  return (
    <div className='dash-sidebar' style={{ width: '200px', background: '#1E2A3B', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div className='dash-sidebar-head' style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '12px', padding: '3px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>出店</div>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>コネクトナビ</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>募集者ダッシュボード</div>
      </div>
      <div className='dash-sidebar-user' style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', color: '#fff', flexShrink: 0 }}>渋</div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>渋谷マルシェ実行委員会</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>募集者</div>
          </div>
        </div>
      </div>
      <nav className='dash-sidebar-nav' style={{ padding: '8px 0', flex: 1 }}>
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', textDecoration: 'none', color: active ? '#fff' : 'rgba(255,255,255,0.6)', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: active ? '3px solid #F5A623' : '3px solid transparent', fontSize: '13px' }}>
              <span>{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>
      <div className='dash-sidebar-back' style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href='/' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textDecoration: 'none' }}>← サイトに戻る</Link>
      </div>
    </div>
  )
}
