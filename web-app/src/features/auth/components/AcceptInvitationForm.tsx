import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useAcceptInvitationMutation } from '../api/authApi'
import { acceptInvitationSchema, type AcceptInvitationFormValues } from '../schemas/auth.schemas'
import type { AcceptInvitationRequest, InvitationPrefillDto } from '../types/auth.types'
import { FormField } from './FormField'
import { FormFeedback } from './FormFeedback'
import { applyFormErrors } from './form-errors'

export function AcceptInvitationForm({ token, invitation }: { token: string; invitation: InvitationPrefillDto }) {
  const [acceptInvitation, { isLoading, reset: resetMutation }] = useAcceptInvitationMutation()
  const navigate = useNavigate()
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      personalEmail: '', contactNumber: '', addressLine1: '', addressLine2: '', city: '', postalCode: '', password: '', confirmPassword: '',
    },
  })
  const pending = isLoading || isSubmitting

  const submit = async (values: AcceptInvitationFormValues) => {
    try {
      // Explicit allowlist: UI-only and privileged properties never reach A06.
      await acceptInvitation((): AcceptInvitationRequest => ({
        token,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        personalEmail: values.personalEmail || null,
        contactNumber: values.contactNumber || null,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        city: values.city || null,
        postalCode: values.postalCode || null,
      })).unwrap()
      reset()
      resetMutation()
      await navigate('/login', {
        replace: true,
        state: { message: 'Registration complete. You can now log in with your company email and password.', tone: 'success' },
      })
    } catch (error) {
      applyFormErrors(error, setError, ['firstName', 'lastName', 'personalEmail', 'contactNumber', 'addressLine1', 'addressLine2', 'city', 'postalCode', 'password'])
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} aria-label="Accept invitation">
      <fieldset disabled={pending} className="space-y-4">
        <legend className="sr-only">Complete your invited account</legend>
        {errors.root?.server?.message && <FormFeedback>{errors.root.server.message}</FormFeedback>}
        <FormField label="Company email" type="email" value={invitation.email} readOnly hint="Your company email is set by your invitation." />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" autoComplete="given-name" {...register('firstName')} error={errors.firstName?.message} required />
          <FormField label="Last name" autoComplete="family-name" {...register('lastName')} error={errors.lastName?.message} required />
          <FormField label="Personal email (optional)" type="email" autoComplete="email" {...register('personalEmail')} error={errors.personalEmail?.message} />
          <FormField label="Contact number (optional)" type="tel" autoComplete="tel" {...register('contactNumber')} error={errors.contactNumber?.message} />
        </div>
        <FormField label="Address line 1 (optional)" autoComplete="address-line1" {...register('addressLine1')} error={errors.addressLine1?.message} />
        <FormField label="Address line 2 (optional)" autoComplete="address-line2" {...register('addressLine2')} error={errors.addressLine2?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="City (optional)" autoComplete="address-level2" {...register('city')} error={errors.city?.message} />
          <FormField label="Postal code (optional)" autoComplete="postal-code" {...register('postalCode')} error={errors.postalCode?.message} />
        </div>
        <FormField label="Password" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} hint="Use 15–128 characters. Spaces and Unicode characters are welcome." required />
        <FormField label="Confirm password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} required />
        <button type="submit" className="button-primary mt-2 w-full px-4 disabled:cursor-not-allowed" aria-busy={pending}>
          {pending ? 'Completing registration…' : 'Accept invitation'}
        </button>
      </fieldset>
    </form>
  )
}
