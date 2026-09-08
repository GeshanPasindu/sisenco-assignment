import { describe, expect, it } from 'vitest'
import { loginSchema, newPasswordSchema } from './auth.schemas'

describe('authentication schemas', () => {
  it('normalizes email without altering password content', () => {
    const result = loginSchema.parse({ email: ' Person@Example.COM ', password: ' leading password ' })

    expect(result).toEqual({ email: 'person@example.com', password: ' leading password ' })
  })

  it('requires the documented password length but permits spaces and Unicode', () => {
    expect(newPasswordSchema.parse('correct horse â˜ƒ')).toBe('correct horse â˜ƒ')
    expect(newPasswordSchema.safeParse('short').success).toBe(false)
  })
})
