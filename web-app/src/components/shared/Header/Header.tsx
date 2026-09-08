import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PAGE_TITLES } from '../../../constants/routes'
import { useAppShell } from '../../../layouts/AppShellProvider'
import { NotificationBell } from './NotificationBell'
import { ProfileMenu } from './ProfileMenu'

export function Header() {
  const { openMobileSidebar, toggleSidebar } = useAppShell()
  const { pathname } = useLocation()
  const [openDropdown, setOpenDropdown] = useState<'notifications' | 'profile' | null>(null)
  const setNotificationsOpen = useCallback((open: boolean) => setOpenDropdown(open ? 'notifications' : null), [])
  const setProfileOpen = useCallback((open: boolean) => setOpenDropdown(open ? 'profile' : null), [])
  const title = PAGE_TITLES[pathname] ?? 'Task Manager'
  return <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
    <div className="flex items-center gap-3"><button type="button" className="button-secondary h-9 min-h-0 px-2 md:hidden" aria-label="Open navigation" onClick={openMobileSidebar}>Menu</button><button type="button" className="button-secondary hidden h-9 min-h-0 px-2 md:inline-flex" aria-label="Toggle sidebar" onClick={toggleSidebar}>☰</button><h1 className="text-lg font-semibold text-slate-900">{title}</h1></div>
    <div className="flex items-center gap-2"><NotificationBell open={openDropdown === 'notifications'} onOpenChange={setNotificationsOpen} /><ProfileMenu open={openDropdown === 'profile'} onOpenChange={setProfileOpen} /></div>
  </header>
}
