import { describe, expect, it } from 'vitest'
import { earlyAccessSignupSchema } from './index.js'

describe('earlyAccessSignupSchema', () => {
  it('accepts an email on its own', () => {
    const result = earlyAccessSignupSchema.safeParse({ email: 'ada@example.com' })

    expect(result.success).toBe(true)
    expect(result.data?.company).toBeUndefined()
  })

  it('trims surrounding whitespace', () => {
    const result = earlyAccessSignupSchema.parse({
      email: '  ada@example.com  ',
      company: '  Analytical Engines  ',
    })

    expect(result).toEqual({ email: 'ada@example.com', company: 'Analytical Engines' })
  })

  it('rejects a malformed email', () => {
    const result = earlyAccessSignupSchema.safeParse({ email: 'ada@' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Valid work email required')
  })

  it('rejects an email over the length limit', () => {
    const result = earlyAccessSignupSchema.safeParse({
      email: `${'a'.repeat(250)}@example.com`,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Email is too long')
  })

  it('rejects a company name over the length limit', () => {
    const result = earlyAccessSignupSchema.safeParse({
      email: 'ada@example.com',
      company: 'a'.repeat(101),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Company name is too long')
  })
})
