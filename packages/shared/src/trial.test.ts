import { describe, expect, it } from 'vitest'
import { computeTrialState } from './trial.js'

const DAY_MS = 24 * 60 * 60 * 1000

describe('computeTrialState', () => {
  it('reports the full window right after the trial starts', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    const trialEndsAt = new Date(now.getTime() + 14 * DAY_MS)

    expect(computeTrialState(trialEndsAt, now)).toEqual({ daysRemaining: 14, isExpired: false })
  })

  it('reports exactly 3 days remaining at the reminder boundary', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    const trialEndsAt = new Date(now.getTime() + 3 * DAY_MS)

    expect(computeTrialState(trialEndsAt, now)).toEqual({ daysRemaining: 3, isExpired: false })
  })

  it('rounds a partial day up so the last day still reads as 1, not 0', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    const trialEndsAt = new Date(now.getTime() + 3 * 60 * 60 * 1000) // 3 hours left

    expect(computeTrialState(trialEndsAt, now)).toEqual({ daysRemaining: 1, isExpired: false })
  })

  it('treats trialEndsAt exactly now as expired', () => {
    const now = new Date('2026-07-01T00:00:00Z')

    expect(computeTrialState(now, now)).toEqual({ daysRemaining: 0, isExpired: true })
  })

  it('does not round a slightly-expired trial up to 1 day remaining', () => {
    const now = new Date('2026-07-01T03:00:00Z')
    const trialEndsAt = new Date('2026-07-01T00:00:00Z') // expired 3 hours ago

    expect(computeTrialState(trialEndsAt, now)).toEqual({ daysRemaining: 0, isExpired: true })
  })

  it('reports 0 days remaining for a trial expired by many days', () => {
    const now = new Date('2026-07-15T00:00:00Z')
    const trialEndsAt = new Date('2026-07-01T00:00:00Z')

    expect(computeTrialState(trialEndsAt, now)).toEqual({ daysRemaining: 0, isExpired: true })
  })
})
