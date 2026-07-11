import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  tenantFindFirstMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  invitationFindFirstMock: vi.fn(),
  insertValuesMock: vi.fn(),
  insertMock: vi.fn(),
  sendAuthEmailMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: {
    query: {
      tenant: { findFirst: mocks.tenantFindFirstMock },
      user: { findFirst: mocks.userFindFirstMock },
    },
  },
  withTenant: async (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      query: { invitation: { findFirst: mocks.invitationFindFirstMock } },
      insert: mocks.insertMock,
    }),
}))

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSessionMock } },
  sendAuthEmail: mocks.sendAuthEmailMock,
  escapeHtml: (value: string) => value,
}))

const { invitesRouter } = await import('./invites.js')

const app = new Hono().route('/api/invites', invitesRouter)

const ADMIN_TENANT_ID = 'tenant-admin'

function postInvite(body: unknown) {
  return app.request('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/invites', () => {
  beforeEach(() => {
    mocks.getSessionMock.mockReset().mockResolvedValue({
      user: { id: 'admin-id', tenantId: ADMIN_TENANT_ID, role: 'admin' },
    })
    mocks.tenantFindFirstMock.mockReset().mockResolvedValue({ name: 'Acme Co' })
    mocks.userFindFirstMock.mockReset()
    mocks.invitationFindFirstMock.mockReset().mockResolvedValue(null)
    mocks.insertMock.mockReset().mockReturnValue({ values: mocks.insertValuesMock })
    mocks.insertValuesMock.mockReset().mockResolvedValue(undefined)
    mocks.sendAuthEmailMock.mockReset().mockResolvedValue(undefined)
  })

  it('rejects non-admin callers', async () => {
    mocks.getSessionMock.mockResolvedValue(null)

    const res = await postInvite({ email: 'someone@example.com', role: 'member' })

    expect(res.status).toBe(403)
    expect(mocks.userFindFirstMock).not.toHaveBeenCalled()
  })

  it('rejects re-inviting an existing member of the same team with a clear error', async () => {
    mocks.userFindFirstMock.mockResolvedValue({
      name: 'Existing Teammate',
      tenantId: ADMIN_TENANT_ID,
    })

    const res = await postInvite({ email: 'teammate@example.com', role: 'member' })

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('ALREADY_MEMBER')
    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.insertValuesMock).not.toHaveBeenCalled()
  })

  it('silently no-ops and notifies the real owner when the email belongs to another tenant', async () => {
    mocks.userFindFirstMock.mockResolvedValue({
      name: 'Someone Else',
      tenantId: 'a-different-tenant',
    })

    const res = await postInvite({ email: 'stranger@example.com', role: 'member' })

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('invited')
    expect(mocks.insertValuesMock).not.toHaveBeenCalled()
    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'stranger@example.com',
      expect.stringContaining('tried to invite you'),
      expect.stringContaining('Someone Else'),
    )
  })

  it('creates an invitation and emails the invitee on success', async () => {
    mocks.userFindFirstMock.mockResolvedValue(null)

    const res = await postInvite({ email: 'new-hire@example.com', role: 'admin' })

    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('invited')
    expect(mocks.insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new-hire@example.com', tenantId: ADMIN_TENANT_ID }),
    )
    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'new-hire@example.com',
      expect.stringContaining("You've been invited"),
      expect.stringContaining('Acme Co'),
    )
  })

  it('rejects a duplicate pending invite within the same tenant', async () => {
    mocks.userFindFirstMock.mockResolvedValue(null)
    mocks.invitationFindFirstMock.mockResolvedValue({ id: 'existing-invite' })

    const res = await postInvite({ email: 'new-hire@example.com', role: 'member' })

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('INVITE_PENDING')
    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })

  it('rejects invalid input with a validation error', async () => {
    const res = await postInvite({ email: 'not-an-email', role: 'member' })

    expect(res.status).toBe(400)
    expect(mocks.userFindFirstMock).not.toHaveBeenCalled()
  })
})
