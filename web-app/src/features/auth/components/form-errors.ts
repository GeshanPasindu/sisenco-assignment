import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { parseApiError } from '../../../services/api/error.utils'

export function applyFormErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  allowedFields: readonly Path<T>[],
) {
  const parsed = parseApiError(error)
  for (const detail of parsed.fieldErrors) {
    const field = allowedFields.find((name) => name === detail.field)
    if (field) setError(field, { type: 'server', message: detail.message })
  }
  setError('root.server', { type: 'server', message: parsed.message })
  return parsed
}
