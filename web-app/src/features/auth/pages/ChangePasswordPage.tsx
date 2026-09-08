import { Link } from 'react-router-dom'
import { ChangePasswordForm } from '../components/ChangePasswordForm'

export function ChangePasswordPage() {
  return (
    <section className="mx-auto w-full max-w-md" aria-labelledby="change-password-heading">
      <div className="mb-7">
        <p className="auth-brand mb-4">Task Manager</p>
        <p className="auth-kicker mb-2">Account security</p>
        <h1 id="change-password-heading" className="auth-heading">Change password</h1>
        <p className="auth-copy mt-2">Changing your password ends all active sessions. You will need to log in again on each device.</p>
      </div>
      <ChangePasswordForm />
      <p className="mt-6 text-center text-sm"><Link to="/" className="auth-link">Back to your workspace</Link></p>
    </section>
  )
}
