import { describe, expect, it } from 'vitest'
import { computeDueDate, isTaskOverdue } from './task.js'

describe('computeDueDate', () => {
  it('returns null when there is no offset (automated or unassigned-due-date steps)', () => {
    expect(computeDueDate('2026-07-01', null)).toBeNull()
  })

  it('adds the offset in whole days to the event date', () => {
    expect(computeDueDate('2026-07-01', 3)).toBe('2026-07-04')
  })

  it('supports a zero offset (due the same day as the event)', () => {
    expect(computeDueDate('2026-07-01', 0)).toBe('2026-07-01')
  })

  it('rolls over a month boundary correctly', () => {
    expect(computeDueDate('2026-07-30', 3)).toBe('2026-08-02')
  })
})

describe('isTaskOverdue', () => {
  it('is not overdue when there is no due date', () => {
    expect(isTaskOverdue(null, 'pending', new Date('2026-07-10T00:00:00Z'))).toBe(false)
  })

  it('is not overdue when the task is already completed, even past its due date', () => {
    expect(isTaskOverdue('2026-07-01', 'completed', new Date('2026-07-10T00:00:00Z'))).toBe(false)
  })

  it('is overdue when pending past the due date', () => {
    expect(isTaskOverdue('2026-07-01', 'pending', new Date('2026-07-02T00:00:00Z'))).toBe(true)
  })

  it('is not overdue when pending and the due date has not arrived yet', () => {
    expect(isTaskOverdue('2026-07-10', 'pending', new Date('2026-07-01T00:00:00Z'))).toBe(false)
  })

  // The boundary, pinned in both directions. Note what this documents: the
  // cutoff is midnight UTC *of* the due date, so a task is reported overdue
  // for the whole of the day it is due — "due today" and "overdue" are the
  // same state here. That may not be the intent; these tests describe the
  // behavior as built, so a deliberate change to it shows up as a failure
  // rather than passing unnoticed.
  it('is not overdue at the exact start of its due date', () => {
    expect(isTaskOverdue('2026-07-01', 'pending', new Date('2026-07-01T00:00:00Z'))).toBe(false)
  })

  it('is already overdue one second into its due date', () => {
    expect(isTaskOverdue('2026-07-01', 'pending', new Date('2026-07-01T00:00:01Z'))).toBe(true)
  })

  it('is overdue late on its due date', () => {
    expect(isTaskOverdue('2026-07-01', 'pending', new Date('2026-07-01T23:59:59Z'))).toBe(true)
  })
})
