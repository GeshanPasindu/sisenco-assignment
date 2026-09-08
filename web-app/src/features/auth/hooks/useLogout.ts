import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogoutMutation } from '../api/authApi'
import { parseApiError } from '../../../services/api/error.utils'
import { ROUTES } from '../../../constants/routes'

export function useLogout() {
  const [logout, { isLoading }] = useLogoutMutation()
  const navigate = useNavigate()
  const signOut = useCallback(async () => {
    let message = 'You have been signed out.'
    let tone: 'success' | 'error' = 'success'
    try { await logout().unwrap() } catch (error) {
      if (parseApiError(error).statusCode !== 401) { message = 'You have been signed out here, but we could not confirm sign-out with the server.'; tone = 'error' }
    }
    await navigate(ROUTES.login, { replace: true, state: { message, tone } })
  }, [logout, navigate])
  return { signOut, isLoggingOut: isLoading }
}
