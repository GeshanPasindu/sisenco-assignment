import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { parseApiError } from '../../../services/api/error.utils'
import { useCheckInvitationMutation } from '../api/authApi'
import { AcceptInvitationForm } from '../components/AcceptInvitationForm'
import { FormFeedback } from '../components/FormFeedback'

export function AcceptInvitationPage({ token }: { token: string | null }) {
  const [checkInvitation, { data, error, isLoading, isUninitialized }] = useCheckInvitationMutation()
  const started = useRef(false)
  const validToken = token !== null && token.length > 0 && token.length <= 512

  useEffect(() => {
    if (validToken && !started.current) {
      started.current = true
      void checkInvitation(() => ({ token }))
    }
  }, [checkInvitation, token, validToken])

  const parsedError = error ? parseApiError(error) : null
  const invalidInvitation = !validToken || parsedError?.code === 'INVALID_INVITATION' || parsedError?.code === 'VALIDATION_FAILED'

  return (
    <section className="mx-auto w-full max-w-xl" aria-labelledby="invitation-heading">
      <div className="mb-7">
        <p className="auth-brand mb-4">Task Manager</p>
        <p className="auth-kicker mb-2">Account activation</p>
        <h1 id="invitation-heading" className="auth-heading">Complete your account</h1>
        <p className="auth-copy mt-2">Confirm your details and choose a password to accept your invitation.</p>
      </div>
      {invalidInvitation ? (
        <FormFeedback>This invitation is invalid or has expired. Ask your manager for a new invitation link.</FormFeedback>
      ) : isLoading || isUninitialized ? (
        <p role="status" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Checking your invitation…</p>
      ) : parsedError ? (
        <div className="space-y-4">
          <FormFeedback>{parsedError.message}</FormFeedback>
          <button type="button" onClick={() => { void checkInvitation(() => ({ token })) }} className="button-secondary px-4">Try again</button>
        </div>
      ) : data ? (
        <AcceptInvitationForm token={token} invitation={data.data} />
      ) : (
        <FormFeedback>We could not check this invitation. Open your invitation link again.</FormFeedback>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="auth-link">Back to log in</Link></p>
    </section>
  )
}
