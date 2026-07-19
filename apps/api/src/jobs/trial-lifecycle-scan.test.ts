import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  subscriptionFindManyMock: vi.fn(),
  organizationFindFirstMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  innerJoinMock: vi.fn(),
  selectWhereMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  sendAuthEmailMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      subscription: { findMany: mocks.subscriptionFindManyMock },
      organization: { findFirst: mocks.organizationFindFirstMock },
    },
    select: mocks.selectMock,
    update: mocks.updateMock,
  },
}))

vi.mock('../auth.js', () => ({
  sendAuthEmail: mocks.sendAuthEmailMock,
  escapeHtml: (value: string) => value,
}))

const { runTrialLifecycleScan } = await import('./trial-lifecycle-scan.js')

const NOW = new Date('2026-07-15T13:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function trialingOrg(overrides: {
  organizationId: string
  trialEndsAt: Date
  trialReminderSentAt?: Date | null
}) {
  return { status: 'trialing', trialReminderSentAt: null, ...overrides }
}

describe('runTrialLifecycleScan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    mocks.subscriptionFindManyMock.mockReset()
    mocks.organizationFindFirstMock.mockReset().mockResolvedValue({ name: 'Acme Co' })
    mocks.selectWhereMock.mockReset().mockResolvedValue([{ email: 'admin@example.com' }])
    mocks.innerJoinMock.mockReset().mockReturnValue({ where: mocks.selectWhereMock })
    mocks.fromMock.mockReset().mockReturnValue({ innerJoin: mocks.innerJoinMock })
    mocks.selectMock.mockReset().mockReturnValue({ from: mocks.fromMock })
    mocks.updateWhereMock.mockReset().mockResolvedValue(undefined)
    mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
    mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
    mocks.sendAuthEmailMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the reminder once for an org within the 3-day window and marks it sent', async () => {
    mocks.subscriptionFindManyMock.mockResolvedValue([
      trialingOrg({ organizationId: 'org-1', trialEndsAt: new Date(NOW.getTime() + 2 * DAY_MS) }),
    ])

    await runTrialLifecycleScan()

    expect(mocks.sendAuthEmailMock).toHaveBeenCalledTimes(1)
    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'admin@example.com',
      expect.stringContaining('3 days'),
      expect.stringContaining('Acme Co'),
    )
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ trialReminderSentAt: NOW })
  })

  it('skips an org whose reminder was already sent', async () => {
    mocks.subscriptionFindManyMock.mockResolvedValue([
      trialingOrg({
        organizationId: 'org-1',
        trialEndsAt: new Date(NOW.getTime() + 2 * DAY_MS),
        trialReminderSentAt: new Date(NOW.getTime() - DAY_MS),
      }),
    ])

    await runTrialLifecycleScan()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('skips an org with more than 3 days remaining', async () => {
    mocks.subscriptionFindManyMock.mockResolvedValue([
      trialingOrg({
        organizationId: 'org-1',
        trialEndsAt: new Date(NOW.getTime() + 10 * DAY_MS),
      }),
    ])

    await runTrialLifecycleScan()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })

  it('flips status to expired for a trial past its end date, without emailing', async () => {
    mocks.subscriptionFindManyMock.mockResolvedValue([
      trialingOrg({ organizationId: 'org-1', trialEndsAt: new Date(NOW.getTime() - DAY_MS) }),
    ])

    await runTrialLifecycleScan()

    expect(mocks.updateSetMock).toHaveBeenCalledWith({ status: 'expired' })
    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })

  it('continues processing remaining orgs when one send fails', async () => {
    mocks.subscriptionFindManyMock.mockResolvedValue([
      trialingOrg({ organizationId: 'org-1', trialEndsAt: new Date(NOW.getTime() + DAY_MS) }),
      trialingOrg({ organizationId: 'org-2', trialEndsAt: new Date(NOW.getTime() + DAY_MS) }),
    ])
    mocks.sendAuthEmailMock
      .mockRejectedValueOnce(new Error('resend outage'))
      .mockResolvedValue(undefined)

    await runTrialLifecycleScan()

    expect(mocks.sendAuthEmailMock).toHaveBeenCalledTimes(2)
    // Only org-2's reminder should be marked sent — org-1's send failed, so
    // its update-after-send never runs.
    expect(mocks.updateSetMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ trialReminderSentAt: NOW })
  })
})
