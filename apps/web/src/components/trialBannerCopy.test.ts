import { describe, expect, it } from 'vitest'
import { describeTrialBanner } from './trialBannerCopy'

describe('describeTrialBanner', () => {
  it('shows the days-remaining countdown while active', () => {
    const result = describeTrialBanner({
      status: 'trialing',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 5,
      isReadOnly: false,
    })

    expect(result).toEqual({ message: '5 days left in your free trial.', variant: 'countdown' })
  })

  it('uses singular "day" when exactly one day remains', () => {
    const result = describeTrialBanner({
      status: 'trialing',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 1,
      isReadOnly: false,
    })

    expect(result.message).toBe('1 day left in your free trial.')
  })

  it('shows the subscribe prompt once read-only, regardless of daysRemaining', () => {
    const result = describeTrialBanner({
      status: 'expired',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 0,
      isReadOnly: true,
    })

    expect(result.variant).toBe('expired')
    expect(result.message).toContain('Subscribe')
  })
})
