import { describe, expect, it } from 'vitest'
import {
  automatedActionKeys,
  getAutomatedAction,
  isAutomatedActionKey,
  parseAutomatedActionConfig,
  substituteAutomationTokens,
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

describe('substituteAutomationTokens', () => {
  const VALUES = {
    employeeName: 'Jane Doe',
    employeeEmail: 'jane@example.com',
    employeeRole: 'Engineer',
    eventDate: '2026-08-01',
  }

  it('fills in all four tokens', () => {
    const result = substituteAutomationTokens(
      'Hi [employeeName] ([employeeRole]), starting [eventDate]. Reach us at [employeeEmail].',
      VALUES,
    )
    expect(result).toBe(
      'Hi Jane Doe (Engineer), starting 2026-08-01. Reach us at jane@example.com.',
    )
  })

  it('leaves a template with no tokens unchanged', () => {
    expect(substituteAutomationTokens('Welcome aboard!', VALUES)).toBe('Welcome aboard!')
  })

  it('leaves an unrecognized bracketed token alone', () => {
    expect(substituteAutomationTokens('Hi [firstName]', VALUES)).toBe('Hi [firstName]')
  })

  it('replaces every occurrence of a repeated token', () => {
    expect(substituteAutomationTokens('[employeeName], welcome [employeeName]!', VALUES)).toBe(
      'Jane Doe, welcome Jane Doe!',
    )
  })

  it('substitutes a token used as the recipient address', () => {
    expect(substituteAutomationTokens('[employeeEmail]', VALUES)).toBe('jane@example.com')
  })
})
