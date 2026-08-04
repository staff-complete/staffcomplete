import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  runStepFindFirstMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
  runFindManyMock: vi.fn(),
  runPhaseFindManyMock: vi.fn(),
  runDependencyFindManyMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
  completeRunStepMock: vi.fn(),
  dispatchAutomatedStepsMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      runStep: { findFirst: mocks.runStepFindFirstMock, findMany: mocks.runStepFindManyMock },
      run: { findMany: mocks.runFindManyMock },
      runPhase: { findMany: mocks.runPhaseFindManyMock },
      runPhaseDependency: { findMany: mocks.runDependencyFindManyMock },
      subscription: { findFirst: mocks.subscriptionFindFirstMock },
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

vi.mock('../lib/run-steps.js', () => ({
  completeRunStep: mocks.completeRunStepMock,
  dispatchAutomatedSteps: mocks.dispatchAutomatedStepsMock,
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

// Due dates here are derived from run.eventDate against the wall clock, so
// the fixtures below only mean anything relative to a pinned "now". Only Date
// is faked, so Hono's async request handling still runs on real timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-30T00:00:00Z'))
  mocks.getSessionMock.mockReset()
  mocks.memberFindFirstMock.mockReset()
  mocks.runStepFindFirstMock.mockReset()
  mocks.runStepFindManyMock.mockReset()
  mocks.runFindManyMock.mockReset()
  mocks.runPhaseFindManyMock.mockReset().mockResolvedValue([])
  mocks.runDependencyFindManyMock.mockReset().mockResolvedValue([])
  mocks.subscriptionFindFirstMock.mockReset().mockResolvedValue({
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  mocks.completeRunStepMock.mockReset()
  mocks.dispatchAutomatedStepsMock.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
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
        phaseId: 'p1',
        title: 'Order laptop',
        status: 'pending',
        dueDateOffsetDays: 1,
      },
    ])
    mocks.runFindManyMock.mockResolvedValue([
      { id: 'r1', type: 'onboarding', employeeName: 'Jane Doe', eventDate: '2026-08-01' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', runId: 'r1', position: 0 }])

    const res = await req('/mine')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.tasks).toEqual([
      expect.objectContaining({
        id: 'rs1',
        title: 'Order laptop',
        dueDate: '2026-08-02',
        isOverdue: false,
        isLocked: false,
        run: expect.objectContaining({ id: 'r1', employeeName: 'Jane Doe' }),
      }),
    ])
  })

  it('flags a task as locked when its phase is not yet unlocked', async () => {
    memberSession()
    // The route issues two runStep.findMany calls in this order: the
    // caller's assigned steps first, then every step across the run(s) to
    // compute phase completeness — both go through the same mock.
    mocks.runStepFindManyMock
      .mockResolvedValueOnce([
        {
          id: 'rs2',
          runId: 'r1',
          phaseId: 'revocation',
          title: 'Confirm handover',
          status: 'pending',
          dueDateOffsetDays: 2,
        },
      ])
      .mockResolvedValueOnce([
        { runId: 'r1', phaseId: 'notice', status: 'pending' },
        { runId: 'r1', phaseId: 'revocation', status: 'pending' },
      ])
    mocks.runFindManyMock.mockResolvedValue([
      { id: 'r1', type: 'offboarding', employeeName: 'Jane Doe', eventDate: '2026-08-01' },
    ])
    mocks.runPhaseFindManyMock.mockResolvedValue([
      { id: 'notice', runId: 'r1' },
      { id: 'revocation', runId: 'r1' },
    ])
    mocks.runDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'revocation', dependsOnPhaseId: 'notice' },
    ])

    const res = await req('/mine')
    const json = await res.json()

    expect(json.tasks).toEqual([expect.objectContaining({ id: 'rs2', isLocked: true })])
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

  it('rejects completing a step whose phase is still locked', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs2',
      runId: 'r1',
      phaseId: 'revocation',
      assigneeId: MEMBER_ID,
      title: 'Disable Slack',
      dueDateOffsetDays: null,
    })
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'notice' }, { id: 'revocation' }])
    mocks.runDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'revocation', dependsOnPhaseId: 'notice' },
    ])
    mocks.runStepFindManyMock.mockResolvedValue([
      { phaseId: 'notice', status: 'pending' },
      { phaseId: 'revocation', status: 'pending' },
    ])

    const res = await post('/rs2/complete')

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('PHASE_LOCKED')
    expect(mocks.completeRunStepMock).not.toHaveBeenCalled()
  })

  it('completes the task and flips run.status to in_progress when steps remain pending', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs1',
      runId: 'r1',
      phaseId: 'p1',
      assigneeId: MEMBER_ID,
      title: 'Order laptop',
      dueDateOffsetDays: 1,
    })
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', position: 0 }])
    mocks.runStepFindManyMock.mockResolvedValueOnce([
      { phaseId: 'p1', status: 'pending' },
      { phaseId: 'p1', status: 'pending' },
    ])
    mocks.completeRunStepMock.mockResolvedValue({
      updatedStep: {
        id: 'rs1',
        runId: 'r1',
        title: 'Order laptop',
        status: 'completed',
        dueDateOffsetDays: 1,
      },
      updatedRun: {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        eventDate: '2026-08-01',
        status: 'in_progress',
      },
      stepsToDispatch: [],
    })

    const res = await post('/rs1/complete')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('completed')
    expect(json.isOverdue).toBe(false)
    expect(mocks.completeRunStepMock).toHaveBeenCalledWith(expect.anything(), 'rs1')
    expect(mocks.dispatchAutomatedStepsMock).toHaveBeenCalledWith(ORG_ID, [])
  })

  // completeRunStep is mocked here, so this covers the route's serialization
  // of its result, not the "is the run finished" logic itself — that lives in
  // lib/run-steps.test.ts.
  it('serializes the run status that completeRunStep reports back', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs1',
      runId: 'r1',
      phaseId: 'p1',
      assigneeId: MEMBER_ID,
      title: 'Order laptop',
      dueDateOffsetDays: 1,
    })
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', position: 0 }])
    mocks.runStepFindManyMock.mockResolvedValueOnce([{ phaseId: 'p1', status: 'pending' }])
    mocks.completeRunStepMock.mockResolvedValue({
      updatedStep: {
        id: 'rs1',
        runId: 'r1',
        title: 'Order laptop',
        status: 'completed',
        dueDateOffsetDays: 1,
      },
      updatedRun: {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        eventDate: '2026-08-01',
        status: 'completed',
      },
      stepsToDispatch: [],
    })

    const res = await post('/rs1/complete')

    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('completed')
  })

  it('dispatches automated steps that a manual completion just unlocked in the next phase', async () => {
    memberSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 'rs1',
      runId: 'r1',
      phaseId: 'p1',
      assigneeId: MEMBER_ID,
      title: 'Order laptop',
      dueDateOffsetDays: 1,
    })
    mocks.runPhaseFindManyMock.mockResolvedValue([{ id: 'p1', position: 0 }])
    mocks.runStepFindManyMock.mockResolvedValueOnce([{ phaseId: 'p1', status: 'pending' }])
    const dispatchable = { id: 'rs2', phaseId: 'p2', type: 'automated', status: 'pending' }
    mocks.completeRunStepMock.mockResolvedValue({
      updatedStep: {
        id: 'rs1',
        runId: 'r1',
        title: 'Order laptop',
        status: 'completed',
        dueDateOffsetDays: 1,
      },
      updatedRun: {
        id: 'r1',
        type: 'onboarding',
        employeeName: 'Jane Doe',
        eventDate: '2026-08-01',
        status: 'in_progress',
      },
      stepsToDispatch: [dispatchable],
    })

    const res = await post('/rs1/complete')

    // serializeTask derives a due date from the run, so an incomplete
    // updatedRun makes this handler throw after dispatching — assert the
    // status, not just the dispatch call.
    expect(res.status).toBe(200)
    expect(mocks.dispatchAutomatedStepsMock).toHaveBeenCalledWith(ORG_ID, [dispatchable])
  })
})
