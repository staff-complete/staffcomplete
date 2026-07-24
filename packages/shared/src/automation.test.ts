import { describe, expect, it } from 'vitest'
import {
  automatedActionKeys,
  getAutomatedAction,
  isAutomatedActionKey,
  parseAutomatedActionConfig,
} from './automation.js'

const VALID_WELCOME_CONFIG = { subject: 'Welcome!', body: 'Hi [employeeName], welcome aboard.' }

describe('getAutomatedAction', () => {
  it('registers the welcome email action with a subject/body config schema', () => {
    expect(automatedActionKeys).toContain('email.send_welcome')
    expect(getAutomatedAction('email.send_welcome').label).toBe('Send welcome email')
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
  it('accepts a config with a subject and body', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', VALID_WELCOME_CONFIG)
    expect(result.success).toBe(true)
  })

  it('rejects a missing config, since subject/body are required', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', undefined)
    expect(result.success).toBe(false)
  })

  it('rejects an empty subject or body', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', { subject: '', body: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an unexpected parameter', () => {
    const result = parseAutomatedActionConfig('email.send_welcome', {
      ...VALID_WELCOME_CONFIG,
      extra: 'nope',
    })
    expect(result.success).toBe(false)
  })
})
