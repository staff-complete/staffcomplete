import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  withTenant: async (_organizationId: string, fn: (tx: unknown) => unknown) =>
    fn({ query: { subscription: { findFirst: mocks.subscriptionFindFirstMock } } }),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
}))

const { billingRouter } = await import('./billing.js')

const app = new Hono().route('/api/billing', billingRouter)

const NOW = new Date('2026-07-15T00:00:00Z')

describe('GET /api/billing/trial-status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.getSessionMock.mockReset().mockResolvedValue({
      user: { id: 'user-1' },
      session: { activeOrganizationId: 'org-1' },
    })
    mocks.subscriptionFindFirstMock.mockReset()
  })

  it('rejects when there is no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await app.request('/api/billing/trial-status')

    expect(res.status).toBe(401)
  })

  it('returns 404 when the org has no subscription row', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue(null)

    const res = await app.request('/api/billing/trial-status')

    expect(res.status).toBe(404)
  })

  it('reports a trialing org with days remaining and not read-only', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'trialing',
      trialEndsAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000),
    })

    const res = await app.request('/api/billing/trial-status')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ status: 'trialing', daysRemaining: 3, isReadOnly: false })
  })

  it('reports an expired trial as read-only', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'trialing',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await app.request('/api/billing/trial-status')
    const json = await res.json()

    expect(json).toMatchObject({ daysRemaining: 0, isReadOnly: true })
  })

  it('reports an active subscription as not read-only even with a past trialEndsAt', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'active',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await app.request('/api/billing/trial-status')
    const json = await res.json()

    expect(json).toMatchObject({ status: 'active', isReadOnly: false })
  })
})
