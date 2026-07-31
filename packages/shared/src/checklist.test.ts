import { describe, expect, it } from 'vitest'
import { createStepSchema, updateStepSchema } from './workflow.js'

const VALID_EMAIL_CONFIG = {
  to: '[employeeEmail]',
  subject: 'Welcome!',
  body: 'Hi [employeeName], welcome aboard.',
}

describe('createStepSchema', () => {
  it('accepts a manual step with a title and no action', () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'manual',
      title: 'Order laptop',
      assigneeId: 'm1',
      dueDateOffsetDays: 2,
    })

    expect(result.success).toBe(true)
  })

  it('rejects a manual step without a title', () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'manual',
    })

    expect(result.success).toBe(false)
  })

  it('accepts an automated step with its own title, a registered action, and valid config', () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'automated',
      title: 'Notify IT of new starter',
      action: 'email.send',
      config: VALID_EMAIL_CONFIG,
    })

    expect(result.success).toBe(true)
  })

  it('rejects an automated step without a title', () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'automated',
      action: 'email.send',
      config: VALID_EMAIL_CONFIG,
    })

    expect(result.success).toBe(false)
  })

  it('rejects an automated step with an unregistered action', () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'automated',
      title: 'Notify IT of new starter',
      action: 'github.create_account',
    })

    expect(result.success).toBe(false)
  })

  it("rejects an automated step whose config doesn't match its action's schema", () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'automated',
      title: 'Notify IT of new starter',
      action: 'email.send',
      config: { unexpectedField: 'nope' },
    })

    expect(result.success).toBe(false)
  })

  it('strips a manual-only field like assigneeId from an automated step (not part of its shape)', () => {
    const result = createStepSchema.safeParse({
      phaseId: 'p1',
      type: 'automated',
      title: 'Notify IT of new starter',
      action: 'email.send',
      config: VALID_EMAIL_CONFIG,
      assigneeId: 'm1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('assigneeId')
    }
  })
})

describe('updateStepSchema', () => {
  it('accepts a bare phase move with no other fields', () => {
    const result = updateStepSchema.safeParse({ phaseId: 'p2' })

    expect(result.success).toBe(true)
  })

  it('accepts updating an automated step to a different registered action', () => {
    const result = updateStepSchema.safeParse({
      action: 'email.send',
      config: VALID_EMAIL_CONFIG,
    })

    expect(result.success).toBe(true)
  })

  it("rejects a config update that doesn't match the given action's schema", () => {
    const result = updateStepSchema.safeParse({
      action: 'email.send',
      config: { unexpectedField: 'nope' },
    })

    expect(result.success).toBe(false)
  })

  it('does not require config validation when action is not part of the update', () => {
    const result = updateStepSchema.safeParse({ title: 'Renamed' })

    expect(result.success).toBe(true)
  })
})
