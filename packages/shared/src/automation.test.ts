import { describe, expect, it } from 'vitest'
import {
  automatedActionKeys,
  automatedActionRegistry,
  isAutomatedActionKey,
  parseAutomatedActionConfig,
} from './automation.js'

describe('automatedActionRegistry', () => {
  it('registers the welcome email action with an empty config schema', () => {
    expect(automatedActionKeys).toContain('email.send_welcome')
    expect(automatedActionRegistry['email.send_welcome'].label).toBe('Send welcome email')
  })
})

describe('isAutomatedActionKey', () => {
  it('is true for a registered action', () => {
    expect(isAutomatedActionKey('email.send_welcome')).toBe(true)
  })

  it('is false for an unregistered string', () => {
    expect(isAutomatedActionKey('github.create_account')).toBe(false)
  })
})

describe('parseAutomatedActionConfig', () => {
  it('accepts an empty config for an action with no parameters', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', {})
    expect(result.success).toBe(true)
  })

  it('defaults a missing config to {} rather than failing', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', undefined)
    expect(result.success).toBe(true)
  })

  it('rejects an unexpected parameter for an action with an empty schema', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', { extra: 'nope' })
    expect(result.success).toBe(false)
  })
})
