import type { ApiError, ApiFieldError } from './api.types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  INVALID_REFRESH_SESSION: 'Your session has ended. Please log in again.',
  INVALID_INVITATION: 'This invitation is invalid or has expired.',
  CURRENT_PASSWORD_INCORRECT: 'Your current password is incorrect.',
  VALIDATION_FAILED: 'Check the highlighted fields and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait a little and try again.',
  UNAUTHENTICATED: 'Please log in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource could not be found.',
  INTERNAL_ERROR: 'The service is temporarily unavailable. Please try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again.',
  SERVER_ERROR: 'The service is temporarily unavailable. Please try again.',
  NETWORK_ERROR: 'Unable to reach the service. Check your connection and try again.',
  SESSION_CHANGED: 'Your session has changed. Please try again.',
  INVALID_RESPONSE: 'The service returned an unexpected response. Please try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
}

const fieldMessages: Record<string, string> = {
  REQUIRED: 'This field is required.',
  IS_NOT_EMPTY: 'This field is required.',
  INVALID_EMAIL: 'Enter a valid email address.',
  IS_EMAIL: 'Enter a valid email address.',
  TOO_LONG: 'This value is too long.',
  MAX_LENGTH: 'This value is too long.',
  TOO_SHORT: 'This value is too short.',
  MIN_LENGTH: 'This value is too short.',
  OUT_OF_RANGE: 'This value is outside the allowed range.',
}

export function safeRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value)
    ? value
    : undefined
}

function parseFields(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((detail: unknown) => {
    if (
      !isRecord(detail) ||
      typeof detail.field !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9.[\]]{0,80}$/.test(detail.field)
    ) {
      return []
    }
    const code =
      typeof detail.code === 'string' && Object.hasOwn(fieldMessages, detail.code)
        ? detail.code
        : 'INVALID_VALUE'
    return [{ field: detail.field, code, message: fieldMessages[code] ?? 'Check this value.' }]
  })
}

/** Never pass through arbitrary server messages, error objects, or fetch metadata. */
export function parseApiError(value: unknown, headerRequestId?: string): ApiError {
  const input = isRecord(value) ? value : {}
  const envelope = isRecord(input.data) ? input.data : input
  const detail = isRecord(envelope.error) ? envelope.error : input
  const statusCode =
    typeof input.status === 'number'
      ? input.status
      : typeof detail.statusCode === 'number'
        ? detail.statusCode
        : null
  const networkFailure = input.status === 'FETCH_ERROR' || input.status === 'TIMEOUT_ERROR'
  const code = networkFailure
    ? 'NETWORK_ERROR'
    : typeof detail.code === 'string' && Object.hasOwn(messages, detail.code)
      ? detail.code
      : statusCode === 429
        ? 'RATE_LIMITED'
        : statusCode !== null && statusCode >= 500
          ? 'SERVER_ERROR'
          : statusCode === 401
            ? 'UNAUTHENTICATED'
            : 'UNKNOWN_ERROR'
  const meta = isRecord(envelope.meta) ? envelope.meta : {}
  const requestId = safeRequestId(headerRequestId ?? meta.requestId ?? input.requestId)
  return {
    statusCode,
    code,
    message: messages[code],
    fieldErrors: parseFields(detail.details ?? detail.fieldErrors),
    ...(requestId ? { requestId } : {}),
  }
}
