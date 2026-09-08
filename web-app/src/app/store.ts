import { configureStore } from '@reduxjs/toolkit'
import { authReducer } from '../features/auth/store/authSlice'
import { baseApi } from '../services/api/baseApi'

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Mutation request secrets stay in a one-shot closure on the dispatched action only.
          // RTK Query does not retain originalArgs in its reducer state.
          ignoredActionPaths: ['meta.arg.originalArgs'],
        },
      }).concat(baseApi.middleware),
    // Authentication data and transient credential factories must never enter devtools history.
    devTools: false,
  })
}

export const store = makeStore()
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
