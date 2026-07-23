import { describe, expect, it } from 'vitest'
import { runHealth } from './runHealth'

describe('runHealth', () => {
  it('is completed when the run status is completed, regardless of overdue steps', () => {
    expect(runHealth({ status: 'completed', overdueStepCount: 3 })).toBe('completed')
  })

  it('is blocked when an active run has at least one overdue step', () => {
    expect(runHealth({ status: 'in_progress', overdueStepCount: 1 })).toBe('blocked')
  })

  it('is onTrack when an active run has no overdue steps', () => {
    expect(runHealth({ status: 'pending', overdueStepCount: 0 })).toBe('onTrack')
  })
})
