import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import { AuthRouteLoading } from './AuthRouteLoading'

export function PublicOnlyRoute({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth()

  if (isInitializing) return <AuthRouteLoading />
  if (isAuthenticated) return <Navigate to="/" replace />

  return children ?? <Outlet />
}
