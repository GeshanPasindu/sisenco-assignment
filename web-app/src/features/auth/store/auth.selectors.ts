import type { AuthState } from '../types/auth.types'

export interface AuthRootState {
  auth: AuthState
}

const noPermissions: string[] = []

export const selectAuthState = (state: AuthRootState) => state.auth
export const selectAuthUser = (state: AuthRootState) => state.auth.user
export const selectAccessToken = (state: AuthRootState) => state.auth.accessToken
export const selectAuthStatus = (state: AuthRootState) => state.auth.status
export const selectIsAuthenticated = (state: AuthRootState) =>
  state.auth.status === 'AUTHENTICATED'
export const selectIsInitializing = (state: AuthRootState) =>
  state.auth.status === 'INITIALIZING'
export const selectRole = (state: AuthRootState) => state.auth.user?.role ?? null
export const selectPermissions = (state: AuthRootState) =>
  state.auth.user?.permissions ?? noPermissions
export const selectHasPermission = (state: AuthRootState, code: string) =>
  selectIsAuthenticated(state) && selectPermissions(state).includes(code)
export const selectHasEveryPermission = (state: AuthRootState, codes: readonly string[]) =>
  selectIsAuthenticated(state) && codes.every((code) => selectPermissions(state).includes(code))
export const selectHasAnyPermission = (state: AuthRootState, codes: readonly string[]) =>
  selectIsAuthenticated(state) && codes.some((code) => selectPermissions(state).includes(code))
