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

const { blockMutationsWhenExpired } = await import('./trial-lock.js')

const NOW = new Date('2026-07-15T00:00:00Z')

function buildApp() {
  const app = new Hono()
  app.all('/*', blockMutationsWhenExpired(), (c) => c.json({ status: 'ok' }))
  return app
}

describe('blockMutationsWhenExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.getSessionMock.mockReset().mockResolvedValue({
      user: { id: 'user-1' },
      session: { activeOrganizationId: 'org-1' },
    })
    mocks.subscriptionFindFirstMock.mockReset()
  })

  it('always allows GET regardless of trial state', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await buildApp().request('/', { method: 'GET' })

    expect(res.status).toBe(200)
    expect(mocks.subscriptionFindFirstMock).not.toHaveBeenCalled()
  })

  it('blocks a mutating request when status is expired', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await buildApp().request('/', { method: 'POST' })

    expect(res.status).toBe(402)
    expect((await res.json()).code).toBe('TRIAL_EXPIRED')
  })

  it('blocks a mutating request when still trialing but past trialEndsAt', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'trialing',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await buildApp().request('/', { method: 'DELETE' })

    expect(res.status).toBe(402)
  })

  it('allows a mutating request when trialing and still current', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'trialing',
      trialEndsAt: new Date(NOW.getTime() + 1000),
    })

    const res = await buildApp().request('/', { method: 'POST' })

    expect(res.status).toBe(200)
  })

  it('does not lock an active subscription from a stale trialEndsAt', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'active',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await buildApp().request('/', { method: 'POST' })

    expect(res.status).toBe(200)
  })

  it('allows the request through when there is no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await buildApp().request('/', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(mocks.subscriptionFindFirstMock).not.toHaveBeenCalled()
  })
})
