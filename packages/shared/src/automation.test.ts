import { describe, expect, it } from 'vitest'
import {
  automatedActionKeys,
  getAutomatedAction,
  isAutomatedActionKey,
  parseAutomatedActionConfig,
} from './automation.js'

const VALID_EMAIL_CONFIG = {
  to: '[employeeEmail]',
  subject: 'Welcome!',
  body: 'Hi [employeeName], welcome aboard.',
}

describe('getAutomatedAction', () => {
  it('registers the send-email action with a to/subject/body config schema', () => {
    expect(automatedActionKeys).toContain('email.send')
    expect(getAutomatedAction('email.send').label).toBe('Send email')
  })
})

describe('isAutomatedActionKey', () => {
  it('is true for a registered action', () => {
    expect(isAutomatedActionKey('email.send')).toBe(true)
  })

  it('is false for an unregistered string', () => {
    expect(isAutomatedActionKey('github.create_account')).toBe(false)
  })
})

describe('parseAutomatedActionConfig', () => {
  it('accepts a config with a recipient, subject, and body', () => {
    const result = parseAutomatedActionConfig('email.send', VALID_EMAIL_CONFIG)
    expect(result.success).toBe(true)
  })

  it('rejects a missing config, since to/subject/body are required', () => {
    const result = parseAutomatedActionConfig('email.send', undefined)
    expect(result.success).toBe(false)
  })

  it('rejects an empty recipient, subject, or body', () => {
    const result = parseAutomatedActionConfig('email.send', { to: '', subject: '', body: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an unexpected parameter', () => {
    const result = parseAutomatedActionConfig('email.send', {
      ...VALID_EMAIL_CONFIG,
      extra: 'nope',
    })
    expect(result.success).toBe(false)
  })
})
