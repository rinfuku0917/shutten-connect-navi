import type { ReactNode } from 'react'
import HostSidebar from '../../components/HostSidebar'

export default function HostLayout({ children }: { children: ReactNode }) {
  return (
    <div className='dash-shell' style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex' }}>
      <HostSidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
