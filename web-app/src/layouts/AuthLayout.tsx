import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'

export function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <main className="auth-shell flex items-center justify-center">
      <div className="auth-panel">{children ?? <Outlet />}</div>
    </main>
  )
}
