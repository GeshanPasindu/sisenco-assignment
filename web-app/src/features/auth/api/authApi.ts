import { baseApi } from '../../../services/api/baseApi'
import {
  beginSessionChange,
  captureSession,
  finishSessionChange,
  invalidResponse,
  invalidateSession,
  sessionChangeIsCurrent,
} from '../../../services/api/baseQueryWithReauth'
import type { SuccessResponse } from '../../../services/api/api.types'
import { clearAuthentication, receiveCredentials } from '../store/authSlice'
import type {
  AcceptInvitationRequest,
  ActivationDto,
  AuthTokensDto,
  ChangePasswordRequest,
  CheckInvitationRequest,
  InvitationPrefillDto,
  LoginRequest,
  PrivatePayload,
} from '../types/auth.types'
import { isActivationResponse, isAuthResponse, isInvitationResponse } from './authResponseGuards'

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<SuccessResponse<AuthTokensDto>, PrivatePayload<LoginRequest>>({
      async queryFn(payload, api, _options, baseQuery) {
        const generation = await beginSessionChange(api)
        const result = await baseQuery({ url: '/auth/login', method: 'POST', body: payload() })
        if (result.error) return { error: result.error, meta: result.meta }
        if (!isAuthResponse(result.data)) return invalidResponse(result.meta)
        if (sessionChangeIsCurrent(api, generation)) api.dispatch(receiveCredentials(result.data.data))
        return { data: result.data, meta: result.meta }
      },
    }),
    refresh: builder.mutation<SuccessResponse<AuthTokensDto>, void>({
      async queryFn(_arg, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/auth/refresh', method: 'POST' })
        if (result.error) return { error: result.error, meta: result.meta }
        if (!isAuthResponse(result.data)) return invalidResponse(result.meta)
        return { data: result.data, meta: result.meta }
      },
    }),
    logout: builder.mutation<void, void>({
      async queryFn(_arg, api, _options, baseQuery) {
        const generation = await beginSessionChange(api, true)
        const result = await baseQuery({ url: '/auth/logout', method: 'POST' })
        if (sessionChangeIsCurrent(api, generation)) api.dispatch(clearAuthentication())
        finishSessionChange(api, generation)
        return result.error ? { error: result.error, meta: result.meta } : { data: undefined, meta: result.meta }
      },
    }),
    changePassword: builder.mutation<void, PrivatePayload<ChangePasswordRequest>>({
      async queryFn(payload, api, _options, baseQuery) {
        const snapshot = captureSession(api)
        const result = await baseQuery({ url: '/auth/change-password', method: 'POST', body: payload() })
        if (result.error) return { error: result.error, meta: result.meta }
        // A refresh during this request may replace the auth object, but is the same session.
        if (sessionChangeIsCurrent(api, snapshot.generation)) {
          invalidateSession(api)
          api.dispatch(clearAuthentication())
        }
        return { data: undefined, meta: result.meta }
      },
    }),
    checkInvitation: builder.mutation<SuccessResponse<InvitationPrefillDto>, PrivatePayload<CheckInvitationRequest>>({
      async queryFn(payload, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/auth/invitations/check', method: 'POST', body: payload() })
        if (result.error) return { error: result.error, meta: result.meta }
        if (!isInvitationResponse(result.data)) return invalidResponse(result.meta)
        return { data: result.data, meta: result.meta }
      },
    }),
    acceptInvitation: builder.mutation<SuccessResponse<ActivationDto>, PrivatePayload<AcceptInvitationRequest>>({
      async queryFn(payload, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/auth/accept-invitation', method: 'POST', body: payload() })
        if (result.error) return { error: result.error, meta: result.meta }
        if (!isActivationResponse(result.data)) return invalidResponse(result.meta)
        return { data: result.data, meta: result.meta }
      },
    }),
  }),
})

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useChangePasswordMutation,
  useCheckInvitationMutation,
  useAcceptInvitationMutation,
} = authApi
