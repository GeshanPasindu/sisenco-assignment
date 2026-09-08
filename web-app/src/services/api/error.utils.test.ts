import { describe, expect, it } from 'vitest'
import { parseApiError } from './error.utils'

describe('parseApiError', () => {
  it('exposes only a safe, typed subset of an error envelope', () => {
    const error = parseApiError({
      status: 400,
      data: {
        error: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Internal validation details must not reach the UI.',
          details: [{ field: 'email', code: 'IS_EMAIL', message: 'Internal message.' }],
        },
        meta: { requestId: 'req_123' },
      },
    })

    expect(error).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields and try again.',
      fieldErrors: [{ field: 'email', code: 'IS_EMAIL', message: 'Enter a valid email address.' }],
      requestId: 'req_123',
    })
  })

  it('maps transport failures to a recoverable network message', () => {
    expect(parseApiError({ status: 'FETCH_ERROR' }).code).toBe('NETWORK_ERROR')
  })
})
