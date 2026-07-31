import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  templateFindFirstMock: vi.fn(),
  templatePhaseFindManyMock: vi.fn(),
  templateDependencyFindManyMock: vi.fn(),
  templateStepFindManyMock: vi.fn(),
  runFindManyMock: vi.fn(),
  runFindFirstMock: vi.fn(),
  runPhaseFindManyMock: vi.fn(),
  runDependencyFindManyMock: vi.fn(),
  runStepFindManyMock: vi.fn(),
  runStepFindFirstMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
  insertMock: vi.fn(),
  insertValuesMock: vi.fn(),
  insertReturningMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateReturningMock: vi.fn(),
  dispatchAutomatedStepsMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      checklistTemplate: { findFirst: mocks.templateFindFirstMock },
      checklistTemplatePhase: { findMany: mocks.templatePhaseFindManyMock },
      checklistTemplatePhaseDependency: { findMany: mocks.templateDependencyFindManyMock },
      checklistTemplateStep: { findMany: mocks.templateStepFindManyMock },
      run: { findMany: mocks.runFindManyMock, findFirst: mocks.runFindFirstMock },
      runPhase: { findMany: mocks.runPhaseFindManyMock },
      runPhaseDependency: { findMany: mocks.runDependencyFindManyMock },
      runStep: { findMany: mocks.runStepFindManyMock, findFirst: mocks.runStepFindFirstMock },
      subscription: { findFirst: mocks.subscriptionFindFirstMock },
    },
    insert: mocks.insertMock,
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

vi.mock('../lib/run-steps.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/run-steps.js')>()
  return { ...actual, dispatchAutomatedSteps: mocks.dispatchAutomatedStepsMock }
})

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

function patchJson(path: string, body: unknown) {
  return req(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_RUN_INPUT = {
  checklistTemplateId: 't1',
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
  mocks.templateDependencyFindManyMock.mockReset().mockResolvedValue([])
  mocks.templateStepFindManyMock.mockReset()
  mocks.runFindManyMock.mockReset()
  mocks.runFindFirstMock.mockReset()
  mocks.runPhaseFindManyMock.mockReset().mockResolvedValue([])
  mocks.runDependencyFindManyMock.mockReset().mockResolvedValue([])
  mocks.runStepFindManyMock.mockReset()
  mocks.runStepFindFirstMock.mockReset()
  mocks.subscriptionFindFirstMock.mockReset().mockResolvedValue({
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  mocks.insertMock.mockReset().mockReturnValue({ values: mocks.insertValuesMock })
  mocks.insertValuesMock.mockReset().mockReturnValue({ returning: mocks.insertReturningMock })
  mocks.insertReturningMock.mockReset()
  mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
  mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
  mocks.updateWhereMock.mockReset().mockReturnValue({ returning: mocks.updateReturningMock })
  mocks.updateReturningMock.mockReset()
  mocks.dispatchAutomatedStepsMock.mockReset().mockResolvedValue(undefined)
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
    mocks.runDependencyFindManyMock.mockResolvedValue([
      { phaseId: 'revocation', dependsOnPhaseId: 'notice' },
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
        title: 'Send email',
        type: 'automated',
        assigneeId: null,
        dueDateOffsetDays: null,
        action: 'email.send',
        config: {
          to: '[employeeEmail]',
          subject: 'Welcome!',
          body: 'Hi [employeeName], welcome aboard.',
        },
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
      // Only two .returning() calls now: run phases are inserted with a
      // client-generated id and never read back (see the comment on
      // runPhaseIdByTemplatePhaseId in runs.ts). The step rows' phaseId must
      // match that same client-generated id (same as the real DB would echo
      // back), so this reads it from the phase insert's own values call
      // rather than hardcoding a placeholder — otherwise the dispatch logic
      // (which cross-references createdPhases against createdSteps by id)
      // would see a phantom mismatch that can't happen for real.
      .mockImplementationOnce(() => {
        const phaseInsertValues = mocks.insertValuesMock.mock.calls.find(
          ([values]) => Array.isArray(values) && values[0]?.name === 'Steps',
        )?.[0] as [{ id: string }]
        const generatedPhaseId = phaseInsertValues[0].id
        return Promise.resolve([
          {
            id: 'rs1',
            phaseId: generatedPhaseId,
            title: 'Order laptop',
            type: 'manual',
            assigneeId: 'm1',
            dueDateOffsetDays: 1,
            status: 'pending',
            position: 0,
          },
          {
            id: 'rs2',
            phaseId: generatedPhaseId,
            title: 'Send email',
            type: 'automated',
            assigneeId: null,
            dueDateOffsetDays: null,
            status: 'pending',
            action: 'email.send',
            config: {
              to: '[employeeEmail]',
              subject: 'Welcome!',
              body: 'Hi [employeeName], welcome aboard.',
            },
            position: 1,
          },
        ])
      })

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

    // The phase insert's generated id is a fresh crypto.randomUUID(), not a
    // fixture — recover it from the call so the step insert's phaseId can be
    // asserted against the real value instead of a hardcoded one.
    const phaseInsertValues = mocks.insertValuesMock.mock.calls.find(
      ([values]) => Array.isArray(values) && values[0]?.name === 'Steps',
    )?.[0] as [{ id: string }]
    const generatedPhaseId = phaseInsertValues[0].id
    expect(generatedPhaseId).toEqual(expect.any(String))

    expect(mocks.insertValuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        runId: 'r1',
        phaseId: generatedPhaseId,
        title: 'Order laptop',
        position: 0,
      }),
      expect.objectContaining({
        runId: 'r1',
        phaseId: generatedPhaseId,
        title: 'Send email',
        action: 'email.send',
        config: {
          to: '[employeeEmail]',
          subject: 'Welcome!',
          body: 'Hi [employeeName], welcome aboard.',
        },
        position: 1,
      }),
    ])
    expect(json.steps).toHaveLength(2)

    // rs2 (automated, email.send) sits in the run's only phase, which is
    // unlocked by definition on a brand-new run — it should be dispatched.
    expect(mocks.dispatchAutomatedStepsMock).toHaveBeenCalledTimes(1)
    const [dispatchedOrgId, dispatchedSteps] = mocks.dispatchAutomatedStepsMock.mock.calls[0] as [
      string,
      Array<{ id: string }>,
    ]
    expect(dispatchedOrgId).toBe(ADMIN_ORG_ID)
    expect(dispatchedSteps).toEqual([expect.objectContaining({ id: 'rs2' })])
  })

  it("copies the template's phase dependencies onto the run's own phase copies", async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({ id: 't1', type: 'onboarding' })
    mocks.templatePhaseFindManyMock.mockResolvedValue([
      { id: 'p1', name: 'Documents', position: 0 },
      { id: 'p2', name: 'Payroll', position: 1 },
    ])
    mocks.templateDependencyFindManyMock.mockResolvedValue([
      { id: 'd1', phaseId: 'p2', dependsOnPhaseId: 'p1' },
    ])
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
    expect(res.status).toBe(201)

    // Phase copy ids are fresh crypto.randomUUID()s generated inside the
    // route — recover them from the runPhase insert call by name, same
    // pattern as the phase-id recovery above.
    const phaseInsertValues = mocks.insertValuesMock.mock.calls.find(
      ([values]) => Array.isArray(values) && values[0]?.name !== undefined,
    )?.[0] as Array<{ id: string; name: string }>
    const documentsId = phaseInsertValues.find((p) => p.name === 'Documents')?.id
    const payrollId = phaseInsertValues.find((p) => p.name === 'Payroll')?.id

    const dependencyInsertValues = mocks.insertValuesMock.mock.calls.find(
      ([values]) => Array.isArray(values) && values[0]?.dependsOnPhaseId !== undefined,
    )?.[0] as Array<{ phaseId: string; dependsOnPhaseId: string }>
    expect(dependencyInsertValues).toEqual([
      expect.objectContaining({ phaseId: payrollId, dependsOnPhaseId: documentsId }),
    ])
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
    expect(mocks.dispatchAutomatedStepsMock).toHaveBeenCalledWith(ADMIN_ORG_ID, [])
  })
})

describe('PATCH /api/runs/:id/steps/:stepId', () => {
  it('returns 404 when the step does not belong to the run', async () => {
    adminSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 's1',
      runId: 'other-run',
      type: 'manual',
      status: 'pending',
    })

    const res = await patchJson('/r1/steps/s1', { assigneeId: 'm1' })

    expect(res.status).toBe(404)
  })

  it('rejects an assignee outside the tenant', async () => {
    adminSession()
    mocks.memberFindFirstMock.mockResolvedValueOnce({ role: 'admin', organizationId: ADMIN_ORG_ID })
    mocks.memberFindFirstMock.mockResolvedValueOnce(null)

    const res = await patchJson('/r1/steps/s1', { assigneeId: 'm1' })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_ASSIGNEE')
  })

  it('rejects reassigning an automated step', async () => {
    adminSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 's1',
      runId: 'r1',
      type: 'automated',
      status: 'pending',
    })

    const res = await patchJson('/r1/steps/s1', { assigneeId: null })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('TYPE_MISMATCH')
  })

  it('rejects reassigning a completed step', async () => {
    adminSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 's1',
      runId: 'r1',
      type: 'manual',
      status: 'completed',
    })

    const res = await patchJson('/r1/steps/s1', { assigneeId: null })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('STEP_COMPLETED')
  })

  it('reassigns a pending manual step to a valid teammate', async () => {
    adminSession()
    mocks.memberFindFirstMock.mockResolvedValueOnce({ role: 'admin', organizationId: ADMIN_ORG_ID })
    mocks.memberFindFirstMock.mockResolvedValueOnce({ id: 'm2', organizationId: ADMIN_ORG_ID })
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 's1',
      runId: 'r1',
      type: 'manual',
      status: 'pending',
    })
    mocks.updateReturningMock.mockResolvedValue([{ id: 's1', assigneeId: 'm2' }])

    const res = await patchJson('/r1/steps/s1', { assigneeId: 'm2' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 's1', assigneeId: 'm2' })
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ assigneeId: 'm2' })
  })

  it('clears the assignee back to unassigned', async () => {
    adminSession()
    mocks.runStepFindFirstMock.mockResolvedValue({
      id: 's1',
      runId: 'r1',
      type: 'manual',
      status: 'pending',
    })
    mocks.updateReturningMock.mockResolvedValue([{ id: 's1', assigneeId: null }])

    const res = await patchJson('/r1/steps/s1', { assigneeId: null })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 's1', assigneeId: null })
  })
})
