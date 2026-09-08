import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useChangePasswordMutation } from '../api/authApi'
import { changePasswordSchema, type ChangePasswordFormValues } from '../schemas/auth.schemas'
import { FormField } from './FormField'
import { FormFeedback } from './FormFeedback'
import { applyFormErrors } from './form-errors'

export function ChangePasswordForm() {
  const [changePassword, { isLoading, reset: resetMutation }] = useChangePasswordMutation()
  const navigate = useNavigate()
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const pending = isLoading || isSubmitting

  const submit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword(() => ({ currentPassword: values.currentPassword, newPassword: values.newPassword })).unwrap()
      reset()
      resetMutation()
      await navigate('/login', {
        replace: true,
        state: { message: 'Your password has been changed and all sessions have ended. Log in again with your new password.', tone: 'success' },
      })
    } catch (error) {
      const parsed = applyFormErrors(error, setError, ['currentPassword', 'newPassword'])
      if (parsed.code === 'CURRENT_PASSWORD_INCORRECT') {
        setError('currentPassword', { type: 'server', message: parsed.message })
      }
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} aria-label="Change password">
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Change your password</legend>
        {errors.root?.server?.message && <FormFeedback>{errors.root.server.message}</FormFeedback>}
        <FormField label="Current password" type="password" autoComplete="current-password" {...register('currentPassword')} error={errors.currentPassword?.message} required />
        <FormField label="New password" type="password" autoComplete="new-password" {...register('newPassword')} error={errors.newPassword?.message} hint="Use 15–128 characters. Spaces and Unicode characters are welcome." required />
        <FormField label="Confirm new password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} required />
        <button type="submit" className="button-primary mt-2 w-full px-4 disabled:cursor-not-allowed" aria-busy={pending}>
          {pending ? 'Changing password…' : 'Change password'}
        </button>
      </fieldset>
    </form>
  )
}
