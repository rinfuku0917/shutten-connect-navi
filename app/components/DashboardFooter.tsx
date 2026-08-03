'use client'
import Link from 'next/link'

// ダッシュボードからトップページに戻るための導線。
// スマホでは globals.css の .admin-sidebar-head が display:none になり
// サイドバーのロゴが消えるため、画面下部にも常に置いておく。
export default function DashboardFooter() {
  return (
    <div style={{ borderTop: '1px solid #E2E8F0', background: '#fff', padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', border: '1px solid #E2E8F0', borderRadius: '999px', padding: '8px 18px', background: '#fff' }}>
        <span style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '12px', padding: '3px 7px', borderRadius: '4px' }}>出店</span>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#1E2A3B' }}>コネクトナビ</span>
      </Link>
      <div style={{ fontSize: '11px', color: '#94A3B8' }}>トップページに戻る</div>
    </div>
  )
}
