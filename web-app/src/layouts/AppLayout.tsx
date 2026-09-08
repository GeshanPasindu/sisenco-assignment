import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '../components/shared/Header/Header'
import { Sidebar } from '../components/shared/Sidebar/Sidebar'
import { AppShellProvider } from './AppShellProvider'

export function AppLayout({ children }: { children?: ReactNode }) {
  return (
    <AppShellProvider>
      <div className="flex min-h-dvh bg-slate-50">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Header />
          <main className="mx-auto max-w-7xl p-4 sm:p-6">{children ?? <Outlet />}</main>
        </div>
      </div>
    </AppShellProvider>
  )
}
