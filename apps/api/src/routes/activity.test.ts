import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  runFindManyMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      run: { findMany: mocks.runFindManyMock },
      runStep: { findMany: mocks.runStepFindManyMock },
    },
  }
}

vi.mock('../db/index.js', () => ({
  db: { query: { member: { findFirst: mocks.memberFindFirstMock } } },
  withTenant: async (_organizationId: string, fn: (t: unknown) => unknown) => fn(tx()),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
}))

const { activityRouter } = await import('./activity.js')

const app = new Hono().route('/api/activity', activityRouter)

const ADMIN_ORG_ID = 'org-admin'

function adminSession(role: 'admin' | 'owner' = 'admin') {
  mocks.getSessionMock.mockResolvedValue({
    user: { id: 'admin-id', email: 'admin@example.com' },
    session: { activeOrganizationId: ADMIN_ORG_ID },
  })
  mocks.memberFindFirstMock.mockResolvedValue({ role, organizationId: ADMIN_ORG_ID })
}

function req() {
  return app.request('/api/activity')
}

beforeEach(() => {
  mocks.getSessionMock.mockReset()
  mocks.memberFindFirstMock.mockReset()
  mocks.runFindManyMock.mockReset()
  mocks.runStepFindManyMock.mockReset()
})

describe('admin gate', () => {
  it('rejects callers with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await req()

    expect(res.status).toBe(403)
  })

  it('rejects members who are not admin or owner', async () => {
    mocks.getSessionMock.mockResolvedValue({
      user: { id: 'u1' },
      session: { activeOrganizationId: ADMIN_ORG_ID },
    })
    mocks.memberFindFirstMock.mockResolvedValue({ role: 'member', organizationId: ADMIN_ORG_ID })

    const res = await req()

    expect(res.status).toBe(403)
  })
})

describe('GET /api/activity', () => {
  it('returns an empty feed when there are no runs', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue([])
    mocks.runStepFindManyMock.mockResolvedValue([])

    const res = await req()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.events).toEqual([])
  })

  it('emits a run_started event for every run', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue([
      {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        status: 'pending',
        createdAt: new Date('2026-07-20T10:00:00Z'),
        updatedAt: new Date('2026-07-20T10:00:00Z'),
      },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([])

    const res = await req()
    const json = await res.json()

    expect(json.events).toEqual([
      expect.objectContaining({
        type: 'run_started',
        runId: 'r1',
        employeeName: 'Jane Doe',
        at: '2026-07-20T10:00:00.000Z',
      }),
    ])
  })

  it('emits a run_completed event only for completed runs', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue([
      {
        id: 'r1',
        type: 'offboarding',
        employeeName: 'Jane Doe',
        status: 'completed',
        createdAt: new Date('2026-07-20T10:00:00Z'),
        updatedAt: new Date('2026-07-21T09:00:00Z'),
      },
      {
        id: 'r2',
        type: 'onboarding',
        employeeName: 'John Smith',
        status: 'in_progress',
        createdAt: new Date('2026-07-19T10:00:00Z'),
        updatedAt: new Date('2026-07-19T10:00:00Z'),
      },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([])

    const res = await req()
    const json = await res.json()

    expect(json.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'run_completed', runId: 'r1' })]),
    )
    expect(json.events.filter((e: { runId: string }) => e.runId === 'r2')).toEqual([
      expect.objectContaining({ type: 'run_started' }),
    ])
  })

  it('emits a step_completed event only for completed steps with a completedAt timestamp', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue([
      {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        status: 'in_progress',
        createdAt: new Date('2026-07-20T10:00:00Z'),
        updatedAt: new Date('2026-07-20T10:00:00Z'),
      },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        runId: 'r1',
        title: 'Order laptop',
        status: 'completed',
        completedAt: new Date('2026-07-21T12:00:00Z'),
      },
      { runId: 'r1', title: 'Create Slack account', status: 'pending', completedAt: null },
    ])

    const res = await req()
    const json = await res.json()

    expect(json.events).toEqual([
      expect.objectContaining({
        type: 'step_completed',
        runId: 'r1',
        employeeName: 'Jane Doe',
        stepTitle: 'Order laptop',
        at: '2026-07-21T12:00:00.000Z',
      }),
      expect.objectContaining({ type: 'run_started', runId: 'r1' }),
    ])
  })

  it('sorts events newest first and caps the feed at 20', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        id: `r${i}`,
        type: 'onboarding',
        employeeName: `Employee ${i}`,
        status: 'pending',
        createdAt: new Date(2026, 0, i + 1),
        updatedAt: new Date(2026, 0, i + 1),
      })),
    )
    mocks.runStepFindManyMock.mockResolvedValue([])

    const res = await req()
    const json = await res.json()

    expect(json.events).toHaveLength(20)
    expect(json.events[0].runId).toBe('r24')
  })
})
