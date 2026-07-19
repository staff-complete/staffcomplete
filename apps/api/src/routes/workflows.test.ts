import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  templateFindFirstMock: vi.fn(),
  templateFindManyMock: vi.fn(),
  stepFindFirstMock: vi.fn(),
  stepFindManyMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
  insertMock: vi.fn(),
  insertValuesMock: vi.fn(),
  insertReturningMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateReturningMock: vi.fn(),
  deleteMock: vi.fn(),
  deleteWhereMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      workflowTemplate: {
        findFirst: mocks.templateFindFirstMock,
        findMany: mocks.templateFindManyMock,
      },
      workflowTemplateStep: {
        findFirst: mocks.stepFindFirstMock,
        findMany: mocks.stepFindManyMock,
      },
      subscription: { findFirst: mocks.subscriptionFindFirstMock },
    },
    insert: mocks.insertMock,
    update: mocks.updateMock,
    delete: mocks.deleteMock,
  }
}

vi.mock('../db/index.js', () => ({
  db: { query: { member: { findFirst: mocks.memberFindFirstMock } } },
  withTenant: async (_organizationId: string, fn: (t: unknown) => unknown) => fn(tx()),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
}))

const { workflowsRouter } = await import('./workflows.js')

const app = new Hono().route('/api/workflows', workflowsRouter)

const ADMIN_ORG_ID = 'org-admin'

function adminSession(role: 'admin' | 'owner' = 'admin') {
  mocks.getSessionMock.mockResolvedValue({
    user: { id: 'admin-id', email: 'admin@example.com' },
    session: { activeOrganizationId: ADMIN_ORG_ID },
  })
  mocks.memberFindFirstMock.mockResolvedValue({ role, organizationId: ADMIN_ORG_ID })
}

function req(path: string, init?: RequestInit) {
  return app.request(path === '/' ? '/api/workflows' : `/api/workflows${path}`, init)
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

function putJson(path: string, body: unknown) {
  return req(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.getSessionMock.mockReset()
  mocks.memberFindFirstMock.mockReset()
  mocks.templateFindFirstMock.mockReset()
  mocks.templateFindManyMock.mockReset()
  mocks.stepFindFirstMock.mockReset()
  mocks.stepFindManyMock.mockReset()
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
  mocks.deleteMock.mockReset().mockReturnValue({ where: mocks.deleteWhereMock })
  mocks.deleteWhereMock.mockReset().mockResolvedValue(undefined)
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

describe('GET /api/workflows', () => {
  it('lists templates with step counts', async () => {
    adminSession()
    mocks.templateFindManyMock.mockResolvedValue([
      {
        id: 't1',
        name: 'Onboarding',
        type: 'onboarding',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 't2',
        name: 'Offboarding',
        type: 'offboarding',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    mocks.stepFindManyMock.mockResolvedValue([
      { workflowTemplateId: 't1' },
      { workflowTemplateId: 't1' },
    ])

    const res = await req('/')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.workflows).toEqual([
      expect.objectContaining({ id: 't1', stepCount: 2 }),
      expect.objectContaining({ id: 't2', stepCount: 0 }),
    ])
  })
})

describe('POST /api/workflows', () => {
  it('creates a workflow template', async () => {
    adminSession()
    mocks.insertReturningMock.mockResolvedValue([
      {
        id: 't1',
        name: 'Onboarding',
        type: 'onboarding',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const res = await postJson('/', { name: 'Onboarding', type: 'onboarding' })

    expect(res.status).toBe(201)
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ADMIN_ORG_ID,
        name: 'Onboarding',
        type: 'onboarding',
      }),
    )
  })

  it('rejects invalid input', async () => {
    adminSession()

    const res = await postJson('/', { name: 'X', type: 'not-a-type' })

    expect(res.status).toBe(400)
  })

  it('rejects when the org trial has expired', async () => {
    adminSession()
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(Date.now() - 1000),
    })

    const res = await postJson('/', { name: 'Onboarding', type: 'onboarding' })

    expect(res.status).toBe(402)
    expect(mocks.insertValuesMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/workflows/:id', () => {
  it('returns 404 for an unknown template', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue(null)

    const res = await req('/missing')

    expect(res.status).toBe(404)
  })

  it('returns the template with steps ordered by position', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({
      id: 't1',
      name: 'Onboarding',
      type: 'onboarding',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mocks.stepFindManyMock.mockResolvedValue([
      {
        id: 's1',
        title: 'Step 1',
        type: 'manual',
        assigneeId: null,
        dueDateOffsetDays: 2,
        position: 0,
      },
    ])

    const res = await req('/t1')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.steps).toHaveLength(1)
    expect(json.steps[0]).toMatchObject({ id: 's1', position: 0 })
  })
})

describe('PATCH /api/workflows/:id', () => {
  it('returns 404 when the template does not exist', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue(null)

    const res = await patchJson('/missing', { name: 'New name' })

    expect(res.status).toBe(404)
  })

  it('updates the template', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({ id: 't1' })
    mocks.updateReturningMock.mockResolvedValue([
      {
        id: 't1',
        name: 'New name',
        type: 'onboarding',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const res = await patchJson('/t1', { name: 'New name' })

    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('New name')
  })
})

describe('DELETE /api/workflows/:id', () => {
  it('returns 404 when the template does not exist', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue(null)

    const res = await req('/missing', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('deletes the template', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({ id: 't1' })

    const res = await req('/t1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(mocks.deleteWhereMock).toHaveBeenCalled()
  })
})

describe('POST /api/workflows/:id/steps', () => {
  it('returns 404 when the workflow does not exist', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue(null)

    const res = await postJson('/missing/steps', { title: 'Step', type: 'manual' })

    expect(res.status).toBe(404)
  })

  it('appends the step at the next position', async () => {
    adminSession()
    mocks.templateFindFirstMock.mockResolvedValue({ id: 't1' })
    mocks.stepFindManyMock.mockResolvedValue([{ position: 0 }, { position: 1 }])
    mocks.insertReturningMock.mockResolvedValue([
      {
        id: 's3',
        title: 'Step 3',
        type: 'manual',
        assigneeId: null,
        dueDateOffsetDays: null,
        position: 2,
      },
    ])

    const res = await postJson('/t1/steps', { title: 'Step 3', type: 'manual' })

    expect(res.status).toBe(201)
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({ position: 2 }))
  })

  it('rejects an assignee that is not on the team', async () => {
    adminSession()
    mocks.memberFindFirstMock.mockResolvedValueOnce({ role: 'admin', organizationId: ADMIN_ORG_ID })
    mocks.memberFindFirstMock.mockResolvedValueOnce({ id: 'm2', organizationId: 'other-org' })

    const res = await postJson('/t1/steps', { title: 'Step', type: 'manual', assigneeId: 'm2' })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_ASSIGNEE')
    expect(mocks.templateFindFirstMock).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/workflows/:id/steps/:stepId', () => {
  it('returns 404 when the step does not belong to the workflow', async () => {
    adminSession()
    mocks.stepFindFirstMock.mockResolvedValue({ id: 's1', workflowTemplateId: 'other-workflow' })

    const res = await patchJson('/t1/steps/s1', { title: 'Renamed' })

    expect(res.status).toBe(404)
  })

  it('updates the step', async () => {
    adminSession()
    mocks.stepFindFirstMock.mockResolvedValue({ id: 's1', workflowTemplateId: 't1' })
    mocks.updateReturningMock.mockResolvedValue([
      {
        id: 's1',
        title: 'Renamed',
        type: 'manual',
        assigneeId: null,
        dueDateOffsetDays: null,
        position: 0,
      },
    ])

    const res = await patchJson('/t1/steps/s1', { title: 'Renamed' })

    expect(res.status).toBe(200)
    expect((await res.json()).title).toBe('Renamed')
  })
})

describe('DELETE /api/workflows/:id/steps/:stepId', () => {
  it('returns 404 when the step does not belong to the workflow', async () => {
    adminSession()
    mocks.stepFindFirstMock.mockResolvedValue({ id: 's1', workflowTemplateId: 'other-workflow' })

    const res = await req('/t1/steps/s1', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('deletes the step', async () => {
    adminSession()
    mocks.stepFindFirstMock.mockResolvedValue({ id: 's1', workflowTemplateId: 't1' })

    const res = await req('/t1/steps/s1', { method: 'DELETE' })

    expect(res.status).toBe(200)
  })
})

describe('PUT /api/workflows/:id/steps/order', () => {
  it('rejects a stepIds set that does not match the existing steps', async () => {
    adminSession()
    mocks.stepFindManyMock.mockResolvedValue([{ id: 's1' }, { id: 's2' }])

    const res = await putJson('/t1/steps/order', { stepIds: ['s1', 's3'] })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
  })

  it('reorders steps by the given stepIds order', async () => {
    adminSession()
    mocks.stepFindManyMock.mockResolvedValue([{ id: 's1' }, { id: 's2' }])

    const res = await putJson('/t1/steps/order', { stepIds: ['s2', 's1'] })

    expect(res.status).toBe(200)
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ position: 0 })
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ position: 1 })
  })
})
