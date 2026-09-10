import { describe, expect, it } from 'vitest'
import { earlyAccessRequestSchema } from './index.js'

describe('earlyAccessRequestSchema', () => {
  it('accepts an email on its own', () => {
    const result = earlyAccessRequestSchema.safeParse({ email: 'ada@example.com' })

    expect(result.success).toBe(true)
    expect(result.data?.company).toBeUndefined()
  })

  it('trims surrounding whitespace', () => {
    const result = earlyAccessRequestSchema.parse({
      email: '  ada@example.com  ',
      company: '  Analytical Engines  ',
    })

    expect(result).toEqual({ email: 'ada@example.com', company: 'Analytical Engines' })
  })

  it('rejects a malformed email', () => {
    const result = earlyAccessRequestSchema.safeParse({ email: 'ada@' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Valid work email required')
  })

  it('rejects an email over the length limit', () => {
    const result = earlyAccessRequestSchema.safeParse({
      email: `${'a'.repeat(250)}@example.com`,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Email is too long')
  })

  it('rejects a company name carrying a line break', () => {
    const result = earlyAccessRequestSchema.safeParse({
      email: 'ada@example.com',
      company: 'Analytical Engines\nEmail: forged@example.com',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Company name cannot contain line breaks')
  })

  it('rejects a company name over the length limit', () => {
    const result = earlyAccessRequestSchema.safeParse({
      email: 'ada@example.com',
      company: 'a'.repeat(101),
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Company name is too long')
  })
})
