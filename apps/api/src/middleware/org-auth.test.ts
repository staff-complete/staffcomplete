import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: { query: { member: { findFirst: mocks.memberFindFirstMock } } },
  withTenant: async (_organizationId: string, fn: (tx: unknown) => unknown) =>
    fn({ query: { subscription: { findFirst: mocks.subscriptionFindFirstMock } } }),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
}))

const { orgAuth } = await import('./org-auth.js')

const NOW = new Date('2026-07-15T00:00:00Z')

function buildApp(options?: { admin?: boolean }) {
  const app = new Hono()
  app.all('/*', orgAuth(options), (c) => c.json({ status: 'ok', orgAuth: c.get('orgAuth') }))
  return app
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  mocks.getSessionMock.mockReset().mockResolvedValue({
    user: { id: 'user-1' },
    session: { activeOrganizationId: 'org-1' },
  })
  mocks.memberFindFirstMock.mockReset().mockResolvedValue({ id: 'member-1', role: 'admin' })
  mocks.subscriptionFindFirstMock.mockReset().mockResolvedValue({
    status: 'trialing',
    trialEndsAt: new Date(NOW.getTime() + 1000),
  })
})

describe('session gate', () => {
  it('rejects a caller with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await buildApp().request('/', { method: 'POST' })

    expect(res.status).toBe(403)
    expect((await res.json()).message).toBe('Sign-in required.')
    // Nothing else is looked up once the session check fails.
    expect(mocks.memberFindFirstMock).not.toHaveBeenCalled()
    expect(mocks.subscriptionFindFirstMock).not.toHaveBeenCalled()
  })

  it('rejects a session with no active organization', async () => {
    mocks.getSessionMock.mockResolvedValue({ user: { id: 'user-1' }, session: {} })

    const res = await buildApp().request('/')

    expect(res.status).toBe(403)
  })

  it('exposes the caller, org, and membership to the handler', async () => {
    mocks.memberFindFirstMock.mockResolvedValue({ id: 'member-9', role: 'owner' })

    const res = await buildApp().request('/')

    expect(await res.json()).toEqual({
      status: 'ok',
      orgAuth: {
        userId: 'user-1',
        organizationId: 'org-1',
        membership: { id: 'member-9', role: 'owner' },
      },
    })
  })

  it('reports a missing membership as null rather than rejecting', async () => {
    mocks.memberFindFirstMock.mockResolvedValue(undefined)

    const res = await buildApp().request('/')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.orgAuth.membership).toBeNull()
  })
})

describe('admin gate', () => {
  it.each(['admin', 'owner'])('admits a %s', async (role) => {
    mocks.memberFindFirstMock.mockResolvedValue({ id: 'member-1', role })

    const res = await buildApp({ admin: true }).request('/')

    expect(res.status).toBe(200)
  })

  it('rejects a plain member', async () => {
    mocks.memberFindFirstMock.mockResolvedValue({ id: 'member-1', role: 'member' })

    const res = await buildApp({ admin: true }).request('/')

    expect(res.status).toBe(403)
    expect((await res.json()).message).toBe('Admin access required.')
  })

  it('rejects a session with no membership at all', async () => {
    mocks.memberFindFirstMock.mockResolvedValue(undefined)

    const res = await buildApp({ admin: true }).request('/')

    expect(res.status).toBe(403)
  })

  it('gives an unauthenticated caller the same message as a non-admin one', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await buildApp({ admin: true }).request('/')

    expect(res.status).toBe(403)
    expect((await res.json()).message).toBe('Admin access required.')
  })
})

describe('trial lock', () => {
  it('always allows GET regardless of trial state', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await buildApp().request('/', { method: 'GET' })

    expect(res.status).toBe(200)
    // The subscription is never even read on a read-only request.
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

  it('allows a mutating request when the org has no subscription row', async () => {
    mocks.subscriptionFindFirstMock.mockResolvedValue(undefined)

    const res = await buildApp().request('/', { method: 'POST' })

    expect(res.status).toBe(200)
  })

  it('checks the trial before admitting a non-admin to an admin route', async () => {
    mocks.memberFindFirstMock.mockResolvedValue({ id: 'member-1', role: 'member' })
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(NOW.getTime() - 1000),
    })

    const res = await buildApp({ admin: true }).request('/', { method: 'POST' })

    // Role is the more specific failure, so it wins over the trial lock.
    expect(res.status).toBe(403)
  })
})
