import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  deleteWhereMock: vi.fn(),
  deleteMock: vi.fn(),
  signUpEmailMock: vi.fn(),
  createOrganizationMock: vi.fn(),
  sendAuthEmailMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: {
    query: { user: { findFirst: mocks.findFirstMock } },
    delete: mocks.deleteMock,
  },
}))

vi.mock('../auth.js', () => ({
  auth: {
    api: {
      signUpEmail: mocks.signUpEmailMock,
      createOrganization: mocks.createOrganizationMock,
    },
  },
  sendAuthEmail: mocks.sendAuthEmailMock,
  escapeHtml: (value: string) => value,
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
    mocks.deleteMock.mockReset().mockReturnValue({ where: mocks.deleteWhereMock })
    mocks.deleteWhereMock.mockReset().mockResolvedValue(undefined)
    mocks.signUpEmailMock.mockReset()
    mocks.createOrganizationMock.mockReset().mockResolvedValue({ id: 'org-id' })
    mocks.sendAuthEmailMock.mockReset().mockResolvedValue(undefined)
  })

  it('responds like a real sign-up when the email is already registered, without creating one', async () => {
    mocks.findFirstMock.mockResolvedValue({ name: 'Existing User' })

    const res = await postOnboard(validBody)

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('pending_verification')
    expect(mocks.signUpEmailMock).not.toHaveBeenCalled()
    expect(mocks.createOrganizationMock).not.toHaveBeenCalled()
    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      validBody.email,
      expect.stringContaining('tried to sign up'),
      expect.stringContaining('Existing User'),
    )
  })

  it('returns a signup error without creating an organization when sign-up fails', async () => {
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
    expect(mocks.createOrganizationMock).not.toHaveBeenCalled()
  })

  it('rolls back the new user when organization creation fails', async () => {
    mocks.findFirstMock.mockResolvedValue(null)
    mocks.signUpEmailMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'new-user-id' } }),
    })
    mocks.createOrganizationMock.mockRejectedValue(new Error('slug taken'))

    const res = await postOnboard(validBody)

    expect(res.status).toBe(500)
    expect((await res.json()).code).toBe('SIGNUP_FAILED')
    expect(mocks.deleteWhereMock).toHaveBeenCalled()
  })

  it('creates the organization for the new user as a server-only action on success', async () => {
    mocks.findFirstMock.mockResolvedValue(null)
    mocks.signUpEmailMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'new-user-id' } }),
    })

    const res = await postOnboard(validBody)

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('pending_verification')
    expect(mocks.createOrganizationMock).toHaveBeenCalledWith({
      body: expect.objectContaining({ name: 'Acme Co', userId: 'new-user-id' }),
    })
    expect(mocks.deleteWhereMock).not.toHaveBeenCalled()
  })

  it('rejects invalid input with a validation error', async () => {
    const res = await postOnboard({ ...validBody, email: 'not-an-email' })

    expect(res.status).toBe(400)
    expect(mocks.findFirstMock).not.toHaveBeenCalled()
  })
})
