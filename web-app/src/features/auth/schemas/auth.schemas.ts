import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address.')
  .max(254, 'Use no more than 254 characters.')
  .email('Enter a valid email address.')

// Passwords are intentionally never trimmed, normalized or otherwise transformed.
export const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use no more than 128 characters.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  })

export const acceptInvitationSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.').max(100, 'Use no more than 100 characters.'),
    lastName: z.string().trim().min(1, 'Enter your last name.').max(100, 'Use no more than 100 characters.'),
    personalEmail: z.union([emailSchema, z.literal('')]),
    contactNumber: z.string().trim().max(30, 'Use no more than 30 characters.'),
    addressLine1: z.string().trim().max(255, 'Use no more than 255 characters.'),
    addressLine2: z.string().trim().max(255, 'Use no more than 255 characters.'),
    city: z.string().trim().max(100, 'Use no more than 100 characters.'),
    postalCode: z.string().trim().max(20, 'Use no more than 20 characters.'),
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
export type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>
