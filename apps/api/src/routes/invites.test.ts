import { Hono } from 'hono'
import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  memberFindFirstMock: vi.fn(),
  invitationFindFirstMock: vi.fn(),
  invitationFindManyMock: vi.fn(),
  organizationFindFirstMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  subscriptionFindFirstMock: vi.fn(),
  createInvitationMock: vi.fn(),
  cancelInvitationMock: vi.fn(),
  acceptInvitationMock: vi.fn(),
  signUpEmailMock: vi.fn(),
  insertValuesMock: vi.fn(),
  insertMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      member: { findFirst: mocks.memberFindFirstMock },
      invitation: {
        findFirst: mocks.invitationFindFirstMock,
        findMany: mocks.invitationFindManyMock,
      },
      organization: { findFirst: mocks.organizationFindFirstMock },
      user: { findFirst: mocks.userFindFirstMock },
    },
    insert: mocks.insertMock,
    update: mocks.updateMock,
  },
  withTenant: async (_organizationId: string, fn: (tx: unknown) => unknown) =>
    fn({
      query: {
        invitation: {
          findFirst: mocks.invitationFindFirstMock,
          findMany: mocks.invitationFindManyMock,
        },
        subscription: { findFirst: mocks.subscriptionFindFirstMock },
      },
    }),
}))

vi.mock('../auth.js', () => ({
  auth: {
    api: {
      getSession: mocks.getSessionMock,
      createInvitation: mocks.createInvitationMock,
      cancelInvitation: mocks.cancelInvitationMock,
      acceptInvitation: mocks.acceptInvitationMock,
      signUpEmail: mocks.signUpEmailMock,
    },
  },
}))

const { invitesRouter } = await import('./invites.js')

const app = new Hono().route('/api/invites', invitesRouter)

const ADMIN_ORG_ID = 'org-admin'

function adminSession(role: 'admin' | 'owner' = 'admin') {
  mocks.getSessionMock.mockResolvedValue({
    user: { id: 'admin-id', email: 'admin@example.com' },
    session: { activeOrganizationId: ADMIN_ORG_ID },
  })
  mocks.memberFindFirstMock.mockResolvedValue({ role })
}

function postInvite(body: unknown) {
  return app.request('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.getSessionMock.mockReset()
  mocks.memberFindFirstMock.mockReset()
  mocks.invitationFindFirstMock.mockReset()
  mocks.invitationFindManyMock.mockReset()
  mocks.organizationFindFirstMock.mockReset()
  mocks.userFindFirstMock.mockReset()
  mocks.subscriptionFindFirstMock.mockReset().mockResolvedValue({
    status: 'trialing',
    trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  mocks.createInvitationMock.mockReset()
  mocks.cancelInvitationMock.mockReset()
  mocks.acceptInvitationMock.mockReset()
  mocks.signUpEmailMock.mockReset()
  mocks.insertMock.mockReset().mockReturnValue({ values: mocks.insertValuesMock })
  mocks.insertValuesMock.mockReset().mockResolvedValue(undefined)
  mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
  mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
  mocks.updateWhereMock.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/invites', () => {
  it('rejects callers with no session', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await postInvite({ email: 'someone@example.com', role: 'member' })

    expect(res.status).toBe(403)
    expect(mocks.memberFindFirstMock).not.toHaveBeenCalled()
  })

  it('rejects callers with no active organization', async () => {
    mocks.getSessionMock.mockResolvedValue({
      user: { id: 'admin-id' },
      session: { activeOrganizationId: null },
    })

    const res = await postInvite({ email: 'someone@example.com', role: 'member' })

    expect(res.status).toBe(403)
    expect(mocks.memberFindFirstMock).not.toHaveBeenCalled()
  })

  it('rejects members who are not admin or owner', async () => {
    adminSession()
    mocks.memberFindFirstMock.mockResolvedValue({ role: 'member' })

    const res = await postInvite({ email: 'someone@example.com', role: 'member' })

    expect(res.status).toBe(403)
    expect(mocks.createInvitationMock).not.toHaveBeenCalled()
  })

  it('maps an already-a-member error from the plugin', async () => {
    adminSession()
    mocks.createInvitationMock.mockRejectedValue(
      APIError.from('BAD_REQUEST', {
        code: 'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION',
        message: 'User is already a member of this organization',
      }),
    )

    const res = await postInvite({ email: 'teammate@example.com', role: 'member' })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_MEMBER')
  })

  it('maps an already-invited error from the plugin', async () => {
    adminSession()
    mocks.createInvitationMock.mockRejectedValue(
      APIError.from('BAD_REQUEST', {
        code: 'USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION',
        message: 'User is already invited to this organization',
      }),
    )

    const res = await postInvite({ email: 'new-hire@example.com', role: 'member' })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('INVITE_PENDING')
  })

  it('delegates to the plugin and succeeds — including for an email that belongs to another org', async () => {
    adminSession('owner')
    mocks.createInvitationMock.mockResolvedValue({ id: 'invite-id' })

    const res = await postInvite({ email: 'new-hire@example.com', role: 'admin' })

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('invited')
    expect(mocks.createInvitationMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { email: 'new-hire@example.com', role: 'admin', organizationId: ADMIN_ORG_ID },
    })
  })

  it('rejects when the org trial has expired', async () => {
    adminSession()
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(Date.now() - 1000),
    })

    const res = await postInvite({ email: 'someone@example.com', role: 'member' })

    expect(res.status).toBe(402)
    expect(mocks.createInvitationMock).not.toHaveBeenCalled()
  })

  it('rejects invalid input with a validation error', async () => {
    const res = await postInvite({ email: 'not-an-email', role: 'member' })

    expect(res.status).toBe(400)
    expect(mocks.getSessionMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/invites', () => {
  it('lists pending invites for the caller organization', async () => {
    adminSession()
    mocks.invitationFindManyMock.mockResolvedValue([
      {
        id: 'i1',
        email: 'a@example.com',
        role: 'member',
        expiresAt: new Date(),
        createdAt: new Date(),
      },
    ])

    const res = await app.request('/api/invites')

    expect(res.status).toBe(200)
    expect((await res.json()).invites).toHaveLength(1)
  })
})

describe('DELETE /api/invites/:id', () => {
  it('cancels a pending invite via the plugin', async () => {
    adminSession()
    mocks.invitationFindFirstMock.mockResolvedValue({ id: 'invite-1' })

    const res = await app.request('/api/invites/invite-1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(mocks.cancelInvitationMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { invitationId: 'invite-1' },
    })
  })

  it('returns 404 when the invite is not pending', async () => {
    adminSession()
    mocks.invitationFindFirstMock.mockResolvedValue(null)

    const res = await app.request('/api/invites/invite-1', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(mocks.cancelInvitationMock).not.toHaveBeenCalled()
  })

  it('rejects when the org trial has expired', async () => {
    adminSession()
    mocks.subscriptionFindFirstMock.mockResolvedValue({
      status: 'expired',
      trialEndsAt: new Date(Date.now() - 1000),
    })

    const res = await app.request('/api/invites/invite-1', { method: 'DELETE' })

    expect(res.status).toBe(402)
    expect(mocks.cancelInvitationMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/invites/:token', () => {
  it('returns 404 for an unknown or expired invite', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(null)

    const res = await app.request('/api/invites/bad-token')

    expect(res.status).toBe(404)
  })

  it('flags accountExists and sessionMatches for the frontend to branch on', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue({
      id: 'invite-1',
      email: 'invitee@example.com',
      role: 'member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      organizationId: ADMIN_ORG_ID,
    })
    mocks.organizationFindFirstMock.mockResolvedValue({ name: 'Acme Co' })
    mocks.userFindFirstMock.mockResolvedValue({ id: 'existing-user' })
    mocks.getSessionMock.mockResolvedValue({ user: { email: 'invitee@example.com' } })

    const res = await app.request('/api/invites/invite-1')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({
      email: 'invitee@example.com',
      organizationName: 'Acme Co',
      accountExists: true,
      sessionMatches: true,
    })
  })
})

describe('POST /api/invites/:token/accept', () => {
  const pendingInvite = {
    id: 'invite-1',
    email: 'invitee@example.com',
    role: 'member',
    status: 'pending',
    organizationId: ADMIN_ORG_ID,
    expiresAt: new Date(Date.now() + 60_000),
  }

  it('returns 404 for an unknown or expired invite', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(null)

    const res = await app.request('/api/invites/bad-token/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(404)
  })

  it('delegates to the plugin when already signed in as the invited email', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(pendingInvite)
    mocks.getSessionMock.mockResolvedValue({ user: { email: 'invitee@example.com' } })
    mocks.acceptInvitationMock.mockResolvedValue({ status: 'accepted' })

    const res = await app.request('/api/invites/invite-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(201)
    expect(mocks.acceptInvitationMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { invitationId: 'invite-1' },
    })
    expect(mocks.signUpEmailMock).not.toHaveBeenCalled()
  })

  it('rejects with ACCOUNT_EXISTS when the email has an account but no matching session', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(pendingInvite)
    mocks.getSessionMock.mockResolvedValue(null)
    mocks.userFindFirstMock.mockResolvedValue({ id: 'existing-user' })

    const res = await app.request('/api/invites/invite-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ACCOUNT_EXISTS')
    expect(mocks.signUpEmailMock).not.toHaveBeenCalled()
  })

  it('requires name and password for a brand-new account', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(pendingInvite)
    mocks.getSessionMock.mockResolvedValue(null)
    mocks.userFindFirstMock.mockResolvedValue(null)

    const res = await app.request('/api/invites/invite-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
  })

  it('signs up a new user, adds them as a member, and marks the invite accepted', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(pendingInvite)
    mocks.getSessionMock.mockResolvedValue(null)
    mocks.userFindFirstMock.mockResolvedValue(null)
    mocks.signUpEmailMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'new-user-id' } }),
    })

    const res = await app.request('/api/invites/invite-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Hire', password: 'Testing123' }),
    })

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('accepted')
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ADMIN_ORG_ID,
        userId: 'new-user-id',
        role: 'member',
      }),
    )
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ status: 'accepted' })
  })

  it('propagates a sign-up failure for a brand-new account', async () => {
    mocks.invitationFindFirstMock.mockResolvedValue(pendingInvite)
    mocks.getSessionMock.mockResolvedValue(null)
    mocks.userFindFirstMock.mockResolvedValue(null)
    mocks.signUpEmailMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Weak password' }),
    })

    const res = await app.request('/api/invites/invite-1/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Hire', password: 'Testing123' }),
    })

    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('SIGNUP_FAILED')
    expect(mocks.insertValuesMock).not.toHaveBeenCalled()
  })
})
