import type { BaseQueryApi } from '@reduxjs/toolkit/query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import authReducer, { receiveCredentials } from '../../features/auth/store/authSlice'
import type { AuthState, AuthTokensDto } from '../../features/auth/types/auth.types'
import { baseQueryWithReauth } from './baseQueryWithReauth'

const refreshedCredentials: AuthTokensDto = {
  accessToken: 'fresh-access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: 'user-id', employeeId: 'EMP-1', email: 'team@example.com', firstName: 'Team', lastName: 'Member',
    role: { id: 'role-id', code: 'TEAM_MEMBER', name: 'Team Member' },
    permissions: [], accountStatus: 'ACTIVE',
  },
}

function apiWithExpiredToken() {
  let auth: AuthState = authReducer(undefined, receiveCredentials({ ...refreshedCredentials, accessToken: 'expired-token' }))
  const getState = () => ({ auth })
  const dispatch = (action: unknown) => {
    auth = authReducer(auth, action as ReturnType<typeof receiveCredentials>)
    return action
  }
  return { api: { dispatch, getState, signal: new AbortController().signal, abort: () => undefined, endpoint: 'test', type: 'query' } as unknown as BaseQueryApi, getAuth: () => auth }
}

function pathFor(input: RequestInfo | URL): string {
  return new URL(input instanceof Request ? input.url : input.toString()).pathname
}

afterEach(() => vi.unstubAllGlobals())

describe('baseQueryWithReauth', () => {
  it('shares one refresh across concurrent protected 401 responses and retries each once', async () => {
    const requests: { path: string; authorization: string | null; credentials: RequestCredentials }[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const request = input as Request
      const path = pathFor(input)
      requests.push({ path, authorization: request.headers.get('Authorization'), credentials: request.credentials })
      if (path === '/api/v1/auth/refresh') {
        return new Response(JSON.stringify({ data: refreshedCredentials, meta: { requestId: 'refresh-1' } }), { status: 200 })
      }
      if (request.headers.get('Authorization') === 'Bearer fresh-access-token') {
        return new Response(JSON.stringify({ data: { ok: true }, meta: { requestId: 'retry-1' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: { statusCode: 401, code: 'UNAUTHENTICATED', message: '', details: [], context: null }, meta: { requestId: 'expired-1' } }), { status: 401 })
    })
    const { api, getAuth } = apiWithExpiredToken()

    const [first, second] = await Promise.all([
      baseQueryWithReauth({ url: '/protected/one' }, api, {}),
      baseQueryWithReauth({ url: '/protected/two' }, api, {}),
    ])

    expect(first.error).toBeUndefined()
    expect(second.error).toBeUndefined()
    expect(requests.filter(({ path }) => path === '/api/v1/auth/refresh')).toHaveLength(1)
    expect(requests.every(({ credentials }) => credentials === 'include')).toBe(true)
    expect(requests.filter(({ path }) => path.startsWith('/api/v1/protected')).some(({ authorization }) => authorization === 'Bearer expired-token')).toBe(true)
    expect(getAuth().accessToken).toBe('fresh-access-token')
  })

  it('does not attempt automatic refresh for login', async () => {
    const paths: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      paths.push(pathFor(input))
      return new Response(JSON.stringify({ error: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: '', details: [], context: null }, meta: { requestId: 'login-1' } }), { status: 401 })
    })
    const { api } = apiWithExpiredToken()

    // RTK Query invokes queryFn's supplied baseQuery without an extra-options value.
    const result = await baseQueryWithReauth(
      { url: '/auth/login', method: 'POST' },
      api,
      undefined as unknown as { skipReauth?: boolean },
    )

    expect(result.error?.code).toBe('INVALID_CREDENTIALS')
    expect(paths).toEqual(['/api/v1/auth/login'])
  })
})
