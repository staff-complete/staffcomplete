import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  templateFindFirstMock: vi.fn(),
  templatePhaseFindManyMock: vi.fn(),
  templateStepFindManyMock: vi.fn(),
  runFindManyMock: vi.fn(),
  runFindFirstMock: vi.fn(),
  runPhaseFindManyMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
  insertMock: vi.fn(),
  insertValuesMock: vi.fn(),
  insertReturningMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      workflowTemplate: { findFirst: mocks.templateFindFirstMock },
      workflowTemplatePhase: { findMany: mocks.templatePhaseFindManyMock },
      workflowTemplateStep: { findMany: mocks.templateStepFindManyMock },
      run: { findMany: mocks.runFindManyMock, findFirst: mocks.runFindFirstMock },
      runPhase: { findMany: mocks.runPhaseFindManyMock },
      runStep: { findMany: mocks.runStepFindManyMock },
      subscription: { findFirst: mocks.subscriptionFindFirstMock },
    },
    insert: mocks.insertMock,
  }
}

vi.mock('../db/index.js', () => ({
  db: { query: { member: { findFirst: mocks.memberFindFirstMock } } },
  withTenant: async (_organizationId: string, fn: (t: unknown) => unknown) => fn(tx()),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
}))

const { runsRouter } = await import('./runs.js')

const app = new Hono().route('/api/runs', runsRouter)

const ADMIN_ORG_ID = 'org-admin'

function adminSession(role: 'admin' | 'owner' = 'admin') {
  mocks.getSessionMock.mockResolvedValue({
    user: { id: 'admin-id', email: 'admin@example.com' },
    session: { activeOrganizationId: ADMIN_ORG_ID },
  })
  mocks.memberFindFirstMock.mockResolvedValue({ role, organizationId: ADMIN_ORG_ID })
}

function req(path: string, init?: RequestInit) {
  return app.request(path === '/' ? '/api/runs' : `/api/runs${path}`, init)
}

function postJson(path: string, body: unknown) {
  return req(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_RUN_INPUT = {
  workflowTemplateId: 't1',
  employeeName: 'Jane Doe',
  employeeEmail: 'jane@example.com',
  employeeRole: 'Engineer',
  eventDate: '2026-08-01',
}

beforeEach(() => {
  mocks.getSessionMock.mockReset()
  mocks.memberFindFirstMock.mockReset()
  mocks.templateFindFirstMock.mockReset()
  mocks.templatePhaseFindManyMock.mockReset().mockResolvedValue([])
  mocks.templateStepFindManyMock.mockReset()
  mocks.runFindManyMock.mockReset()
  mocks.runFindFirstMock.mockReset()
  mocks.runPhaseFindManyMock.mockReset().mockResolvedValue([])
  mocks.runStepFindManyMock.mockReset()
  mocks.subscriptionFindFirstMock.mockReset().mockResolvedValue({
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  mocks.insertMock.mockReset().mockReturnValue({ values: mocks.insertValuesMock })
  mocks.insertValuesMock.mockReset().mockReturnValue({ returning: mocks.insertReturningMock })
  mocks.insertReturningMock.mockReset()
})

describe('admin gate', () => {
  it('rejects callers with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await req('/')

    expect(res.status).toBe(403)
  })

  it('rejects members who are not admin or owner', async () => {
    mocks.getSessionMock.mockResolvedValue({
      user: { id: 'u1' },
      session: { activeOrganizationId: ADMIN_ORG_ID },
    })
    mocks.memberFindFirstMock.mockResolvedValue({ role: 'member', organizationId: ADMIN_ORG_ID })

    const res = await req('/')

    expect(res.status).toBe(403)
  })
})

describe('GET /api/runs', () => {
  it('lists runs with step counts and completed step counts', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue([
      {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        employeeEmail: 'jane@example.com',
        employeeRole: 'Engineer',
        eventDate: '2026-08-01',
        status: 'pending',
        createdAt: new Date(),
      },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        runId: 'r1',
        status: 'completed',
        title: 'Order laptop',
        dueDateOffsetDays: 0,
        position: 0,
      },
      {
        runId: 'r1',
        status: 'pending',
        title: 'Schedule orientation',
        dueDateOffsetDays: 1,
        position: 1,
      },
    ])

    const res = await req('/')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.runs).toEqual([
      expect.objectContaining({
        id: 'r1',
        stepCount: 2,
        completedStepCount: 1,
        overdueStepCount: 0,
        overdueStepTitle: null,
      }),
    ])
  })

  it('flags a run as having overdue steps when a pending step is past its due date', async () => {
    adminSession()
    mocks.runFindManyMock.mockResolvedValue([
      {
        id: 'r1',
        type: 'offboarding',
        employeeName: 'Jane Doe',
        employeeEmail: 'jane@example.com',
        employeeRole: 'Engineer',
        eventDate: '2020-01-01',
        status: 'in_progress',
        createdAt: new Date(),
      },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        runId: 'r1',
        status: 'completed',
        title: 'Revoke access',
        dueDateOffsetDays: 0,
        position: 0,
      },
      {
        runId: 'r1',
        status: 'pending',
        title: 'Collect laptop',
        dueDateOffsetDays: 1,
        position: 1,
      },
      {
        runId: 'r1',
        status: 'pending',
        title: 'Exit interview',
        dueDateOffsetDays: 2,
        position: 2,
      },
    ])

    const res = await req('/')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.runs).toEqual([
      expect.objectContaining({
        id: 'r1',
        overdueStepCount: 2,
        overdueStepTitle: 'Collect laptop',
      }),
    ])
  })
})

describe('GET /api/runs/:id', () => {
  it('rejects callers with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await req('/r1')

    expect(res.status).toBe(403)
  })

  it('returns 404 when the run does not exist', async () => {
    adminSession()
    mocks.runFindFirstMock.mockResolvedValue(undefined)

    const res = await req('/r1')

    expect(res.status).toBe(404)
  })

  it('returns the run with its phases, steps, due dates, and overdue flags', async () => {
    adminSession()
    mocks.runFindFirstMock.mockResolvedValue({
      id: 'r1',
      type: 'onboarding',
      employeeName: 'Jane Doe',
      employeeEmail: 'jane@example.com',
      employeeRole: 'Engineer',
      eventDate: '2020-01-01',
      status: 'in_progress',
      createdAt: new Date(),
    })
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', name: 'Steps', position: 0 }])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        id: 'rs1',
        phaseId: 'p1',
        title: 'Order laptop',
        type: 'manual',
        assigneeId: 'm1',
        dueDateOffsetDays: 1,
        status: 'pending',
        position: 0,
      },
      {
        id: 'rs2',
        phaseId: 'p1',
        title: 'Create Slack account',
        type: 'automated',
        assigneeId: null,
        dueDateOffsetDays: null,
        status: 'completed',
        position: 1,
      },
    ])

    const res = await req('/r1')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(
      expect.objectContaining({
        id: 'r1',
        status: 'in_progress',
        phases: [expect.objectContaining({ id: 'p1', isLocked: false })],
        steps: [
          expect.objectContaining({
            id: 'rs1',
            status: 'pending',
            dueDate: '2020-01-02',
            isOverdue: true,
            isLocked: false,
          }),
          expect.objectContaining({
            id: 'rs2',
            status: 'completed',
            dueDate: null,
            isOverdue: false,
            isLocked: false,
          }),
        ],
      }),
    )
  })

  it('locks a later phase until every step in the earlier phase is completed', async () => {
    adminSession()
    mocks.runFindFirstMock.mockResolvedValue({
      id: 'r1',
      type: 'offboarding',
      employeeName: 'Jane Doe',
      employeeEmail: 'jane@example.com',
      employeeRole: 'Engineer',
      eventDate: '2026-07-24',
      status: 'in_progress',
      createdAt: new Date(),
    })
    mocks.runPhaseFindManyMock.mockResolvedValue([
      { id: 'notice', name: 'Notice received', position: 0 },
      { id: 'revocation', name: 'Access revocation', position: 1 },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([
      {
        id: 'rs1',
        phaseId: 'notice',
        title: 'Notify manager',
        type: 'automated',
        assigneeId: null,
        dueDateOffsetDays: null,
        status: 'pending',
        position: 0,
      },
      {
        id: 'rs2',
        phaseId: 'revocation',
        title: 'Disable GitHub',
        type: 'automated',
        assigneeId: null,
        dueDateOffsetDays: null,
        status: 'pending',
        position: 0,
      },
    ])

    const res = await req('/r1')
    const json = await res.json()

    expect(json.phases).toEqual([
      expect.objectContaining({ id: 'notice', isLocked: false }),
      expect.objectContaining({ id: 'revocation', isLocked: true }),
    ])
    expect(json.steps).toEqual([
      expect.objectContaining({ id: 'rs1', isLocked: false }),
      expect.objectContaining({ id: 'rs2', isLocked: true }),
    ])
  })
})

describe('POST /api/runs', () => {
  it('returns 404 when the template does not exist', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue(null)

    const res = await postJson('/', VALID_RUN_INPUT)

    expect(res.status).toBe(404)
  })

  it('rejects invalid input', async () => {
    adminSession()

    const res = await postJson('/', { ...VALID_RUN_INPUT, employeeEmail: 'not-an-email' })

    expect(res.status).toBe(400)
  })

  it('rejects when the org trial has expired', async () => {
    adminSession()
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(Date.now() - 1000),
    })

    const res = await postJson('/', VALID_RUN_INPUT)

    expect(res.status).toBe(402)
    expect(mocks.templateFindFirstMock).not.toHaveBeenCalled()
  })

  it('creates a run and copies the template phases and steps onto it', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({ id: 't1', type: 'onboarding' })
    mocks.templatePhaseFindManyMock.mockResolvedValue([{ id: 'p1', name: 'Steps', position: 0 }])
    mocks.templateStepFindManyMock.mockResolvedValue([
      {
        id: 'ts1',
        phaseId: 'p1',
        title: 'Order laptop',
        type: 'manual',
        assigneeId: 'm1',
        dueDateOffsetDays: 1,
        position: 0,
      },
      {
        id: 'ts2',
        phaseId: 'p1',
        title: 'Create Slack account',
        type: 'automated',
        assigneeId: null,
        dueDateOffsetDays: null,
        position: 1,
      },
    ])
    mocks.insertReturningMock
      .mockResolvedValueOnce([
        {
          id: 'r1',
          type: 'onboarding',
          employeeName: 'Jane Doe',
          employeeEmail: 'jane@example.com',
          employeeRole: 'Engineer',
          eventDate: '2026-08-01',
          status: 'pending',
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([{ id: 'rp1', name: 'Steps', position: 0 }])
      .mockResolvedValueOnce([
        {
          id: 'rs1',
          phaseId: 'rp1',
          title: 'Order laptop',
          type: 'manual',
          assigneeId: 'm1',
          dueDateOffsetDays: 1,
          position: 0,
        },
        {
          id: 'rs2',
          phaseId: 'rp1',
          title: 'Create Slack account',
          type: 'automated',
          assigneeId: null,
          dueDateOffsetDays: null,
          position: 1,
        },
      ])

    const res = await postJson('/', VALID_RUN_INPUT)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ADMIN_ORG_ID,
        type: 'onboarding',
        employeeName: 'Jane Doe',
      }),
    )
    expect(mocks.insertValuesMock).toHaveBeenCalledWith([
      expect.objectContaining({ runId: 'r1', name: 'Steps', position: 0 }),
    ])
    expect(mocks.insertValuesMock).toHaveBeenCalledWith([
      expect.objectContaining({ runId: 'r1', phaseId: 'rp1', title: 'Order laptop', position: 0 }),
      expect.objectContaining({
        runId: 'r1',
        phaseId: 'rp1',
        title: 'Create Slack account',
        position: 1,
      }),
    ])
    expect(json.steps).toHaveLength(2)
  })

  it('creates a run with no phases or steps when the template has none', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({ id: 't1', type: 'onboarding' })
    mocks.templatePhaseFindManyMock.mockResolvedValue([])
    mocks.templateStepFindManyMock.mockResolvedValue([])
    mocks.insertReturningMock.mockResolvedValueOnce([
      {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        employeeEmail: 'jane@example.com',
        employeeRole: 'Engineer',
        eventDate: '2026-08-01',
        status: 'pending',
        createdAt: new Date(),
      },
    ])

    const res = await postJson('/', VALID_RUN_INPUT)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.steps).toEqual([])
    expect(mocks.insertMock).toHaveBeenCalledTimes(1)
  })
})
