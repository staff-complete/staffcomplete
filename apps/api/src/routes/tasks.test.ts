import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  runStepFindFirstMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
  runFindManyMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateReturningMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      runStep: { findFirst: mocks.runStepFindFirstMock, findMany: mocks.runStepFindManyMock },
      run: { findMany: mocks.runFindManyMock },
      subscription: { findFirst: mocks.subscriptionFindFirstMock },
    },
    update: mocks.updateMock,
  }
}

vi.mock('../db/index.js', () => ({
  db: { query: { member: { findFirst: mocks.memberFindFirstMock } } },
  withTenant: async (_organizationId: string, fn: (t: unknown) => unknown) => fn(tx()),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
}))

const { tasksRouter } = await import('./tasks.js')

const app = new Hono().route('/api/tasks', tasksRouter)

const ORG_ID = 'org-1'
const MEMBER_ID = 'member-1'

function memberSession() {
  mocks.getSessionMock.mockResolvedValue({
    user: { id: 'user-1' },
    session: { activeOrganizationId: ORG_ID },
  })
  mocks.memberFindFirstMock.mockResolvedValue({ id: MEMBER_ID })
}

function req(path: string, init?: RequestInit) {
  return app.request(`/api/tasks${path}`, init)
}

function post(path: string) {
  return req(path, { method: 'POST' })
}

beforeEach(() => {
  mocks.getSessionMock.mockReset()
  mocks.memberFindFirstMock.mockReset()
  mocks.runStepFindFirstMock.mockReset()
  mocks.runStepFindManyMock.mockReset()
  mocks.runFindManyMock.mockReset()
  mocks.subscriptionFindFirstMock.mockReset().mockResolvedValue({
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  mocks.updateReturningMock.mockReset()
  mocks.updateWhereMock.mockReset().mockReturnValue({ returning: mocks.updateReturningMock })
  mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
  mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
})

describe('GET /api/tasks/mine', () => {
  it('rejects callers with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await req('/mine')

    expect(res.status).toBe(403)
  })

  it('returns an empty list when the caller has no membership', async () => {
    mocks.getSessionMock.mockResolvedValue({
      user: { id: 'user-1' },
      session: { activeOrganizationId: ORG_ID },
    })
    mocks.memberFindFirstMock.mockResolvedValue(undefined)

    const res = await req('/mine')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.tasks).toEqual([])
  })

  it('lists manual tasks assigned to the caller with a derived due date', async () => {
    memberSession()
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        id: 'rs1',
        runId: 'r1',
        title: 'Order laptop',
        status: 'pending',
        dueDateOffsetDays: 1,
      },
    ])
    mocks.runFindManyMock.mockResolvedValue([
      { id: 'r1', type: 'onboarding', employeeName: 'Jane Doe', eventDate: '2026-08-01' },
    ])

    const res = await req('/mine')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.tasks).toEqual([
      expect.objectContaining({
        id: 'rs1',
        title: 'Order laptop',
        dueDate: '2026-08-02',
        isOverdue: expect.any(Boolean),
        run: expect.objectContaining({ id: 'r1', employeeName: 'Jane Doe' }),
      }),
    ])
  })
})

describe('POST /api/tasks/:id/complete', () => {
  it('rejects callers with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await post('/rs1/complete')

    expect(res.status).toBe(403)
  })

  it('returns 404 when the task does not exist', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue(undefined)

    const res = await post('/rs1/complete')

    expect(res.status).toBe(404)
  })

  it("rejects completing another member's task", async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs1',
      runId: 'r1',
      assigneeId: 'someone-else',
    })

    const res = await post('/rs1/complete')

    expect(res.status).toBe(403)
  })

  it('rejects when the org trial has expired', async () => {
    memberSession()
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(Date.now() - 1000),
    })

    const res = await post('/rs1/complete')

    expect(res.status).toBe(402)
    expect(mocks.runStepFindFirstMock).not.toHaveBeenCalled()
  })

  it('completes the task and flips run.status to in_progress when steps remain pending', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs1',
      runId: 'r1',
      assigneeId: MEMBER_ID,
      title: 'Order laptop',
      dueDateOffsetDays: 1,
    })
    mocks.runStepFindManyMock.mockResolvedValue([{ status: 'completed' }, { status: 'pending' }])
    mocks.updateReturningMock
      .mockResolvedValueOnce([
        {
          id: 'rs1',
          runId: 'r1',
          title: 'Order laptop',
          status: 'completed',
          dueDateOffsetDays: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'r1',
          type: 'onboarding',
          employeeName: 'Jane Doe',
          eventDate: '2026-08-01',
          status: 'in_progress',
        },
      ])

    const res = await post('/rs1/complete')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('completed')
    expect(json.isOverdue).toBe(false)
    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'in_progress' }),
    )
  })

  it('flips run.status to completed when every step is done', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs1',
      runId: 'r1',
      assigneeId: MEMBER_ID,
      title: 'Order laptop',
      dueDateOffsetDays: 1,
    })
    mocks.runStepFindManyMock.mockResolvedValue([{ status: 'completed' }])
    mocks.updateReturningMock
      .mockResolvedValueOnce([
        {
          id: 'rs1',
          runId: 'r1',
          title: 'Order laptop',
          status: 'completed',
          dueDateOffsetDays: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'r1',
          type: 'onboarding',
          employeeName: 'Jane Doe',
          eventDate: '2026-08-01',
          status: 'completed',
        },
      ])

    const res = await post('/rs1/complete')

    expect(res.status).toBe(200)
    expect(mocks.updateSetMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'completed' }),
    )
  })
})
