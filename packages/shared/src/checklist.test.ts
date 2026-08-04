import { describe, expect, it } from 'vitest'
import {
  checklistTypeSchema,
  createChecklistTemplateSchema,
  createPhaseSchema,
  createStepSchema,
  reorderPhasesSchema,
  updateStepSchema,
} from './checklist.js'

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

describe('checklistTypeSchema', () => {
  it('accepts the two lifecycle events that exist today', () => {
    expect(checklistTypeSchema.safeParse('onboarding').success).toBe(true)
    expect(checklistTypeSchema.safeParse('offboarding').success).toBe(true)
  })

  // role_change is named in the domain model but not built — it must not
  // slip through as a valid checklist type until it is.
  it('rejects a lifecycle event that is not implemented', () => {
    expect(checklistTypeSchema.safeParse('role_change').success).toBe(false)
  })
})

describe('createChecklistTemplateSchema', () => {
  it('accepts a two-character name — the shortest allowed', () => {
    const result = createChecklistTemplateSchema.safeParse({ name: 'IT', type: 'onboarding' })

    expect(result.success).toBe(true)
  })

  it('rejects a one-character name', () => {
    const result = createChecklistTemplateSchema.safeParse({ name: 'I', type: 'onboarding' })

    expect(result.success).toBe(false)
  })

  it('rejects a template with no type', () => {
    const result = createChecklistTemplateSchema.safeParse({ name: 'Engineering onboarding' })

    expect(result.success).toBe(false)
  })
})

describe('createPhaseSchema', () => {
  it('accepts a two-character name and rejects a shorter one', () => {
    expect(createPhaseSchema.safeParse({ name: 'IT' }).success).toBe(true)
    expect(createPhaseSchema.safeParse({ name: 'I' }).success).toBe(false)
  })
})

describe('reorderPhasesSchema', () => {
  it('requires at least one phase id', () => {
    expect(reorderPhasesSchema.safeParse({ phaseIds: ['p1'] }).success).toBe(true)
    expect(reorderPhasesSchema.safeParse({ phaseIds: [] }).success).toBe(false)
  })
})
