import { type PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { useRefreshMutation } from '../api/authApi'
import { selectAuthStatus } from '../store/auth.selectors'
import { initializationUnauthenticated } from '../store/authSlice'

function BootstrapLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-medium text-slate-700">Restoring your session…</p>
      </div>
    </main>
  )
}

export function AuthBootstrap({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch()
  const status = useAppSelector(selectAuthStatus)
  const [refresh] = useRefreshMutation()
  const started = useRef(false)

  const initialise = useCallback(async () => {
    try {
      await refresh().unwrap()
    } catch {
      // The login page remains available when the API is offline. It can show a
      // connection error only after the user actively attempts to sign in.
      dispatch(initializationUnauthenticated())
    }
  }, [dispatch, refresh])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void initialise()
  }, [initialise])

  return status === 'INITIALIZING' ? <BootstrapLoading /> : children
}
