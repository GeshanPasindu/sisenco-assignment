import {
  fetchBaseQuery,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type QueryReturnValue,
} from '@reduxjs/toolkit/query/react'
import { env } from '../../config/env'
import { isAuthResponse } from '../../features/auth/api/authResponseGuards'
import { clearAuthentication, receiveCredentials } from '../../features/auth/store/authSlice'
import type { AuthRootState } from '../../features/auth/store/auth.selectors'
import type { AuthState } from '../../features/auth/types/auth.types'
import type { ApiError, ApiMeta } from './api.types'
import { parseApiError, safeRequestId } from './error.utils'

interface ReauthOptions {
  skipReauth?: boolean
}

type ApiResult = QueryReturnValue<unknown, ApiError, ApiMeta>

interface SessionCoordinator {
  generation: number
  refresh?: Promise<ApiResult>
  endingSession: boolean
}

// Isolate refresh coordination per Redux store (including tests and future SSR).
const coordinators = new WeakMap<() => unknown, SessionCoordinator>()

function coordinatorFor(api: BaseQueryApi): SessionCoordinator {
  let coordinator = coordinators.get(api.getState)
  if (!coordinator) {
    coordinator = { generation: 0, endingSession: false }
    coordinators.set(api.getState, coordinator)
  }
  return coordinator
}

function authFor(api: BaseQueryApi): AuthState {
  return (api.getState() as AuthRootState).auth
}

export function captureSession(api: BaseQueryApi) {
  return { generation: coordinatorFor(api).generation, auth: authFor(api) }
}

export function sessionIsCurrent(api: BaseQueryApi, snapshot: ReturnType<typeof captureSession>) {
  return coordinatorFor(api).generation === snapshot.generation && authFor(api) === snapshot.auth
}

export function invalidateSession(api: BaseQueryApi) {
  coordinatorFor(api).generation += 1
}

/** Wait for any cookie rotation before sending the request that expires/replaces it. */
export async function beginSessionChange(api: BaseQueryApi, endingSession = false) {
  const coordinator = coordinatorFor(api)
  coordinator.generation += 1
  coordinator.endingSession = endingSession
  const generation = coordinator.generation
  await coordinator.refresh
  return generation
}

export function sessionChangeIsCurrent(api: BaseQueryApi, generation: number) {
  return coordinatorFor(api).generation === generation
}

export function finishSessionChange(api: BaseQueryApi, generation: number) {
  if (sessionChangeIsCurrent(api, generation)) coordinatorFor(api).endingSession = false
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
  timeout: 15_000,
  prepareHeaders(headers, { getState }) {
    headers.set('Accept', 'application/json')
    const token = (getState() as AuthRootState).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

async function request(args: string | FetchArgs, api: BaseQueryApi): Promise<ApiResult> {
  const result = await rawBaseQuery(args, api, {})
  const requestId = safeRequestId(result.meta?.response?.headers.get('X-Request-Id'))
  const meta: ApiMeta = requestId ? { requestId } : {}
  // fetchBaseQuery's Request contains the body. Never forward it to Redux action metadata.
  return result.error
    ? { error: parseApiError(result.error, requestId), meta }
    : { data: result.data, meta }
}

export function invalidResponse(meta?: ApiMeta): ApiResult & { error: ApiError } {
  return { error: parseApiError({ code: 'INVALID_RESPONSE' }, meta?.requestId), meta }
}

function sessionChanged(): ApiResult {
  return { error: parseApiError({ code: 'SESSION_CHANGED', statusCode: 401 }) }
}

function refreshSession(api: BaseQueryApi): Promise<ApiResult> {
  const coordinator = coordinatorFor(api)
  if (coordinator.endingSession) return Promise.resolve(sessionChanged())
  if (coordinator.refresh) return coordinator.refresh

  const snapshot = captureSession(api)
  // A caller unmounting/aborting must not cancel the refresh other requests share.
  const controller = new AbortController()
  const refreshApi = { ...api, signal: controller.signal, abort: () => controller.abort() }
  const pending = (async (): Promise<ApiResult> => {
    const result = await request({ url: '/auth/refresh', method: 'POST' }, refreshApi)
    if (!sessionIsCurrent(api, snapshot)) return sessionChanged()
    if (result.error) return result
    if (!isAuthResponse(result.data)) return invalidResponse(result.meta)
    api.dispatch(receiveCredentials(result.data.data))
    return result
  })()
  coordinator.refresh = pending
  void pending.finally(() => {
    if (coordinator.refresh === pending) coordinator.refresh = undefined
  })
  return pending
}

const publicAuthPaths = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/invitations/check',
  '/auth/accept-invitation',
])

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  ApiError,
  ReauthOptions,
  ApiMeta
> = async (args, api, extraOptions) => {
  const url = typeof args === 'string' ? args : args.url
  if (url === '/auth/refresh') return refreshSession(api)
  const skipReauth = extraOptions?.skipReauth || publicAuthPaths.has(url)
  const coordinator = coordinatorFor(api)
  if (!skipReauth && coordinator.refresh) await coordinator.refresh
  const snapshot = captureSession(api)
  const result = await request(args, api)
  if (skipReauth || result.error?.statusCode !== 401 || coordinator.endingSession) return result

  // A late 401 from the old token can arrive after another refresh already finished.
  if (!sessionIsCurrent(api, snapshot)) {
    return authFor(api).accessToken && coordinator.generation === snapshot.generation
      ? request(args, api)
      : result
  }
  if (authFor(api).status === 'UNAUTHENTICATED') return result

  const refreshResult = await refreshSession(api)
  if (refreshResult.error) {
    if (sessionIsCurrent(api, snapshot)) api.dispatch(clearAuthentication())
    return result
  }
  if (coordinator.generation !== snapshot.generation || !authFor(api).accessToken) return result
  // Deliberately use the raw request wrapper so a second 401 cannot recurse.
  const retried = await request(args, api)
  if (retried.error?.statusCode === 401 && coordinator.generation === snapshot.generation) {
    api.dispatch(clearAuthentication())
  }
  return retried
}
