import { NavLink } from 'react-router-dom'
import { useAuth } from '../../../features/auth/hooks/useAuth'
import { useGetUnreadCountQuery } from '../../../features/notifications/api/notificationsApi'
import { useAppShell } from '../../../layouts/AppShellProvider'
import { getVisibleSidebarItems } from './sidebar.config'

export function Sidebar() {
  const { role, permissions } = useAuth()
  const { isSidebarCollapsed, isMobileSidebarOpen, closeMobileSidebar } = useAppShell()
  const { data } = useGetUnreadCountQuery(undefined, { skip: !permissions.includes('notification:read_own') })
  const items = getVisibleSidebarItems(role?.code, permissions)
  const content = <nav className="space-y-1" aria-label="Main navigation">{items.map((item) => {
    const unread = item.id === 'notifications' ? data?.data.count ?? 0 : 0
    return <NavLink key={item.id} to={item.path} end={item.end} onClick={closeMobileSidebar} title={isSidebarCollapsed ? item.label : undefined} className={({ isActive }) => `flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
      <span className={isSidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
      {unread > 0 && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
    </NavLink>
  })}</nav>
  return <>
    <aside className={`hidden shrink-0 border-r border-slate-200 bg-white p-3 md:block ${isSidebarCollapsed ? 'w-16' : 'w-56'}`}>{content}</aside>
    {isMobileSidebarOpen && <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation"><button className="absolute inset-0 bg-slate-950/20" type="button" aria-label="Close navigation" onClick={closeMobileSidebar} /><aside className="relative h-full w-72 bg-white p-4 shadow-lg">{content}</aside></div>}
  </>
}
