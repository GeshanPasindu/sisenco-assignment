import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, AuthTokensDto } from '../types/auth.types'

const initialState: AuthState = {
  accessToken: null,
  user: null,
  status: 'INITIALIZING',
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    receiveCredentials(state, action: PayloadAction<AuthTokensDto>) {
      state.accessToken = action.payload.accessToken
      state.user = action.payload.user
      state.status = 'AUTHENTICATED'
    },
    updateSessionUser(
      state,
      action: PayloadAction<Pick<AuthTokensDto['user'], 'firstName' | 'lastName'>>,
    ) {
      if (state.user) Object.assign(state.user, action.payload)
    },
    clearAuthentication: () => ({
      accessToken: null,
      user: null,
      status: 'UNAUTHENTICATED' as const,
    }),
    initializationUnauthenticated(state) {
      if (state.status === 'INITIALIZING') {
        state.accessToken = null
        state.user = null
        state.status = 'UNAUTHENTICATED'
      }
    },
  },
})

export const { receiveCredentials, updateSessionUser, clearAuthentication, initializationUnauthenticated } =
  authSlice.actions
export const receivingCredentials = receiveCredentials
export const authReducer = authSlice.reducer
export default authReducer
