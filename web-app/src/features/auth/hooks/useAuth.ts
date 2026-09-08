import { useAppSelector } from '../../../app/hooks'
import { selectAuthState } from '../store/auth.selectors'

export function useAuth() {
  const { user, accessToken, status } = useAppSelector(selectAuthState)
  const permissions = user?.permissions ?? []
  const isAuthenticated = status === 'AUTHENTICATED'
  return {
    user,
    accessToken,
    isAuthenticated,
    isInitializing: status === 'INITIALIZING',
    role: user?.role ?? null,
    permissions,
    hasPermission: (code: string) => isAuthenticated && permissions.includes(code),
    hasEveryPermission: (codes: readonly string[]) =>
      isAuthenticated && codes.every((code) => permissions.includes(code)),
    hasAnyPermission: (codes: readonly string[]) =>
      isAuthenticated && codes.some((code) => permissions.includes(code)),
  }
}
