import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  withTenantMock: vi.fn(),
  insertMock: vi.fn(),
  valuesMock: vi.fn(),
  onConflictDoNothingMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  withTenant: mocks.withTenantMock,
}))

const { startTrialIfNeeded } = await import('./start-trial.js')
const { subscription } = await import('../db/schema.js')

describe('startTrialIfNeeded', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.onConflictDoNothingMock.mockReset().mockResolvedValue(undefined)
    mocks.valuesMock
      .mockReset()
      .mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothingMock })
    mocks.insertMock.mockReset().mockReturnValue({ values: mocks.valuesMock })
    mocks.withTenantMock
      .mockReset()
      .mockImplementation((_organizationId: string, fn: (tx: unknown) => unknown) =>
        fn({ insert: mocks.insertMock }),
      )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('inserts a trialing subscription 14 days out, scoped to the organization', async () => {
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'))

    await startTrialIfNeeded('org-1')

    expect(mocks.withTenantMock).toHaveBeenCalledWith('org-1', expect.any(Function))
    expect(mocks.insertMock).toHaveBeenCalledWith(subscription)
    expect(mocks.valuesMock).toHaveBeenCalledWith({
      organizationId: 'org-1',
      status: 'trialing',
      trialStartedAt: new Date('2026-07-01T00:00:00Z'),
      trialEndsAt: new Date('2026-07-15T00:00:00Z'),
    })
  })

  it('is a no-op on conflict, keyed on organizationId', async () => {
    await startTrialIfNeeded('org-1')

    // True concurrent-insert idempotency is a DB-level guarantee (the
    // primary key constraint), not something a mocked test can prove —
    // this only asserts the conflict target is wired correctly.
    expect(mocks.onConflictDoNothingMock).toHaveBeenCalledWith({
      target: subscription.organizationId,
    })
  })
})
