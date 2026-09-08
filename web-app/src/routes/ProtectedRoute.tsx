import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import { AuthRouteLoading } from './AuthRouteLoading'

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth()
  const { pathname, search, hash } = useLocation()

  if (isInitializing) return <AuthRouteLoading />

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname, search, hash } }}
      />
    )
  }

  return children ?? <Outlet />
}
