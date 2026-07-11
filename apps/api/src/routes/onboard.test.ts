import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  insertValuesMock: vi.fn(),
  insertMock: vi.fn(),
  deleteWhereMock: vi.fn(),
  deleteMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateMock: vi.fn(),
  signUpEmailMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: {
    query: { user: { findFirst: mocks.findFirstMock } },
    insert: mocks.insertMock,
    delete: mocks.deleteMock,
    update: mocks.updateMock,
  },
}))

vi.mock('../auth.js', () => ({
  auth: { api: { signUpEmail: mocks.signUpEmailMock } },
}))

const { onboardRouter } = await import('./onboard.js')

const app = new Hono().route('/api/onboard', onboardRouter)

const validBody = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'Testing123',
  company: 'Acme Co',
}

function postOnboard(body: unknown) {
  return app.request('/api/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/onboard', () => {
  beforeEach(() => {
    mocks.findFirstMock.mockReset()
    mocks.insertMock.mockReset().mockReturnValue({ values: mocks.insertValuesMock })
    mocks.insertValuesMock.mockReset().mockResolvedValue(undefined)
    mocks.deleteMock.mockReset().mockReturnValue({ where: mocks.deleteWhereMock })
    mocks.deleteWhereMock.mockReset().mockResolvedValue(undefined)
    mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
    mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
    mocks.updateWhereMock.mockReset().mockResolvedValue(undefined)
    mocks.signUpEmailMock.mockReset()
  })

  it('responds like a real sign-up when the email is already registered, without creating one', async () => {
    mocks.findFirstMock.mockResolvedValue({ id: 'existing-user' })

    const res = await postOnboard(validBody)

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('pending_verification')
    expect(mocks.signUpEmailMock).not.toHaveBeenCalled()
    expect(mocks.insertValuesMock).not.toHaveBeenCalled()
  })

  it('rolls back the tenant when sign-up fails', async () => {
    mocks.findFirstMock.mockResolvedValue(null)
    mocks.signUpEmailMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Weak password' }),
    })

    const res = await postOnboard(validBody)

    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.code).toBe('SIGNUP_FAILED')
    expect(json.message).toBe('Weak password')
    expect(mocks.deleteWhereMock).toHaveBeenCalled()
  })

  it('creates a tenant and links the admin user on success', async () => {
    mocks.findFirstMock.mockResolvedValue(null)
    mocks.signUpEmailMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'new-user-id' } }),
    })

    const res = await postOnboard(validBody)

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('pending_verification')
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Co' }),
    )
    expect(mocks.updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: expect.any(String) }),
    )
    expect(mocks.updateWhereMock).toHaveBeenCalled()
  })

  it('rejects invalid input with a validation error', async () => {
    const res = await postOnboard({ ...validBody, email: 'not-an-email' })

    expect(res.status).toBe(400)
    expect(mocks.findFirstMock).not.toHaveBeenCalled()
  })
})
