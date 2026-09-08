import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLoginMutation } from '../api/authApi'
import { loginSchema, type LoginFormValues } from '../schemas/auth.schemas'
import { FormField } from './FormField'
import { FormFeedback } from './FormFeedback'
import { applyFormErrors } from './form-errors'

function getDestination(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/'
  const from = state.from
  if (typeof from !== 'object' || from === null || !('pathname' in from) || typeof from.pathname !== 'string') return '/'
  const pathname = from.pathname
  // Keep navigation inside the application and out of public-only redirect loops.
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\') || ['/login', '/accept-invitation'].includes(pathname)) return '/'
  const search = 'search' in from && typeof from.search === 'string' && from.search.startsWith('?') ? from.search : ''
  const hash = 'hash' in from && typeof from.hash === 'string' && from.hash.startsWith('#') ? from.hash : ''
  return `${pathname}${search}${hash}`
}

export function LoginForm() {
  const [login, { isLoading, reset: resetMutation }] = useLoginMutation()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, setError, resetField, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const pending = isLoading || isSubmitting

  const submit = async (values: LoginFormValues) => {
    try {
      await login(() => ({ email: values.email, password: values.password })).unwrap()
      resetField('password')
      resetMutation()
      await navigate(getDestination(location.state), { replace: true })
    } catch (error) {
      applyFormErrors(error, setError, ['email', 'password'])
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} aria-label="Log in">
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Log in with your company account</legend>
        {errors.root?.server?.message && <FormFeedback>{errors.root.server.message}</FormFeedback>}
        <FormField label="Company email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('email')} error={errors.email?.message} required />
        <FormField label="Password" type="password" autoComplete="current-password" {...register('password')} error={errors.password?.message} required />
        <button type="submit" className="button-primary mt-2 w-full px-4 disabled:cursor-not-allowed" aria-busy={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </fieldset>
    </form>
  )
}
