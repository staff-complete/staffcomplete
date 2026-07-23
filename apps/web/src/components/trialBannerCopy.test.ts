import { describe, expect, it } from 'vitest'
import { describeTrialBanner } from './trialBannerCopy'

describe('describeTrialBanner', () => {
  it('reports countdown variant with days remaining while active', () => {
    const result = describeTrialBanner({
      status: 'trialing',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 5,
      isReadOnly: false,
    })

    expect(result).toEqual({ variant: 'countdown', daysRemaining: 5 })
  })

  it('reports the exact daysRemaining value, including one', () => {
    const result = describeTrialBanner({
      status: 'trialing',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 1,
      isReadOnly: false,
    })

    expect(result.daysRemaining).toBe(1)
  })

  it('reports the expired variant once read-only, regardless of daysRemaining', () => {
    const result = describeTrialBanner({
      status: 'expired',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 0,
      isReadOnly: true,
    })

    expect(result.variant).toBe('expired')
  })
})
