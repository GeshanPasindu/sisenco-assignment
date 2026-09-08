import { useLocation } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { FormFeedback } from '../components/FormFeedback'

export function LoginPage() {
  const { state } = useLocation()
  const notice: unknown = state
  const message = typeof notice === 'object' && notice !== null && 'message' in notice && typeof notice.message === 'string' ? notice.message : null
  const tone = typeof notice === 'object' && notice !== null && 'tone' in notice && notice.tone === 'error' ? 'error' : 'success'

  return (
    <section className="mx-auto w-full max-w-md" aria-labelledby="login-heading">
      <div className="mb-7">
        <p className="auth-brand mb-4">Task Manager</p>
        <p className="auth-kicker mb-2">Sign in</p>
        <h1 id="login-heading" className="auth-heading">Welcome back</h1>
        <p className="auth-copy mt-2">Log in with your company account to continue.</p>
      </div>
      {message && <div className="mb-6"><FormFeedback tone={tone}>{message}</FormFeedback></div>}
      <LoginForm />
      <p className="mt-6 text-center text-xs leading-5 text-slate-500">Access is by invitation from your manager.</p>
    </section>
  )
}
