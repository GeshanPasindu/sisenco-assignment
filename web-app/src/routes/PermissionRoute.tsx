import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import type { RoleCode } from '../features/auth/types/auth.types'
import { ForbiddenPage } from './ForbiddenPage'
import { ProtectedRoute } from './ProtectedRoute'

export interface PermissionRouteProps {
  allOf?: string[]
  anyOf?: string[]
  requiredRoles?: RoleCode[]
  children?: ReactNode
}

export function PermissionRoute({ allOf, anyOf, requiredRoles, children }: PermissionRouteProps) {
  const { hasEveryPermission, hasAnyPermission, role } = useAuth()
  const allowed =
    (allOf === undefined || hasEveryPermission(allOf)) &&
    (anyOf === undefined || hasAnyPermission(anyOf)) &&
    (requiredRoles === undefined || (role !== null && requiredRoles.includes(role.code)))

  return (
    <ProtectedRoute>
      {allowed ? (children ?? <Outlet />) : <ForbiddenPage />}
    </ProtectedRoute>
  )
}
