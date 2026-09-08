import { describe, expect, it } from 'vitest'
import {
  selectHasAnyPermission,
  selectHasEveryPermission,
  selectIsAuthenticated,
} from './auth.selectors'
import authReducer, {
  clearAuthentication,
  initializationUnauthenticated,
  receiveCredentials,
} from './authSlice'
import type { AuthTokensDto } from '../types/auth.types'

const credentials: AuthTokensDto = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'user-id',
    employeeId: 'EMP-1',
    email: 'team@example.com',
    firstName: 'Team',
    lastName: 'Member',
    role: { id: 'role-id', code: 'TEAM_MEMBER', name: 'Team Member' },
    permissions: ['profile:read_own', 'profile:update_own'],
    accountStatus: 'ACTIVE',
  },
}

describe('authSlice', () => {
  it('stores credentials and exposes permission checks', () => {
    const state = authReducer(undefined, receiveCredentials(credentials))

    expect(selectIsAuthenticated({ auth: state })).toBe(true)
    expect(selectHasEveryPermission({ auth: state }, ['profile:read_own', 'profile:update_own'])).toBe(true)
    expect(selectHasAnyPermission({ auth: state }, ['users:read', 'profile:update_own'])).toBe(true)
  })

  it('finishes bootstrap unauthenticated and clears session state', () => {
    const unauthenticated = authReducer(undefined, initializationUnauthenticated())
    const cleared = authReducer(authReducer(undefined, receiveCredentials(credentials)), clearAuthentication())

    expect(unauthenticated.status).toBe('UNAUTHENTICATED')
    expect(cleared).toEqual({ accessToken: null, user: null, status: 'UNAUTHENTICATED' })
  })
})
