import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { auth, escapeHtml, sendAuthEmail } from '../auth.js'
import { db } from '../db/index.js'
import { invitation, tenant, user } from '../db/schema.js'

const SEVENTY_TWO_HOURS_IN_MS = 72 * 60 * 60 * 1000

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'member']),
})

const acceptInviteSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

type AdminSession = {
  user: { id: string; tenantId: string; role: string }
}

async function requireAdmin(c: Context): Promise<AdminSession | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session || role !== 'admin' || !tenantId) {
    return null
  }
  return { user: { id: session.user.id, tenantId, role } }
}

export const invitesRouter = new Hono()

invitesRouter.get('/', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const invites = await db.query.invitation.findMany({
    where: and(eq(invitation.tenantId, session.user.tenantId), eq(invitation.status, 'pending')),
    columns: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  })

  return c.json({ invites })
})

invitesRouter.post('/', zValidator('json', inviteSchema), async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const { email, role } = c.req.valid('json')
  const normalizedEmail = email.toLowerCase()
  const tenantId = session.user.tenantId

  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, normalizedEmail),
    columns: { id: true },
  })
  if (existingUser) {
    return c.json(
      { code: 'EMAIL_IN_USE', message: 'An account with this email already exists.' },
      409,
    )
  }

  const existingInvite = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.email, normalizedEmail),
      eq(invitation.tenantId, tenantId),
      eq(invitation.status, 'pending'),
    ),
    columns: { id: true },
  })
  if (existingInvite) {
    return c.json(
      { code: 'INVITE_PENDING', message: 'An invite is already pending for this email.' },
      409,
    )
  }

  const tenantRow = await db.query.tenant.findFirst({
    where: eq(tenant.id, tenantId),
    columns: { name: true },
  })

  const id = crypto.randomUUID()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SEVENTY_TWO_HOURS_IN_MS)

  await db.insert(invitation).values({
    id,
    tenantId,
    email: normalizedEmail,
    role,
    invitedByUserId: session.user.id,
    token,
    status: 'pending',
    expiresAt,
  })

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`
  const companyName = tenantRow ? escapeHtml(tenantRow.name) : 'StaffComplete'

  await sendAuthEmail(
    email,
    `You've been invited to join ${companyName} on StaffComplete`,
    `
      <p>You've been invited to join <strong>${companyName}</strong> on StaffComplete as a ${role === 'admin' ? 'an admin' : 'team member'}.</p>
      <p><a href="${acceptUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invite</a></p>
      <p>This link expires in 72 hours. If you weren't expecting this invite, you can safely ignore this email.</p>
    `,
  )

  return c.json({ status: 'invited' }, 201)
})

invitesRouter.delete('/:id', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const id = c.req.param('id')
  const result = await db
    .update(invitation)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(invitation.id, id),
        eq(invitation.tenantId, session.user.tenantId),
        eq(invitation.status, 'pending'),
      ),
    )
    .returning({ id: invitation.id })

  if (result.length === 0) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found.' }, 404)
  }

  return c.json({ status: 'revoked' })
})

invitesRouter.get('/:token', async (c) => {
  const token = c.req.param('token')
  const invite = await db.query.invitation.findFirst({ where: eq(invitation.token, token) })

  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return c.json(
      { code: 'INVALID_INVITE', message: 'This invite link is invalid or has expired.' },
      404,
    )
  }

  const tenantRow = await db.query.tenant.findFirst({
    where: eq(tenant.id, invite.tenantId),
    columns: { name: true },
  })

  return c.json({ email: invite.email, role: invite.role, tenantName: tenantRow?.name ?? null })
})

invitesRouter.post('/:token/accept', zValidator('json', acceptInviteSchema), async (c) => {
  const token = c.req.param('token')
  const { name, password } = c.req.valid('json')

  const invite = await db.query.invitation.findFirst({ where: eq(invitation.token, token) })
  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return c.json(
      { code: 'INVALID_INVITE', message: 'This invite link is invalid or has expired.' },
      404,
    )
  }

  const signUpResponse = await auth.api.signUpEmail({
    body: {
      name,
      email: invite.email,
      password,
      callbackURL: process.env.APP_URL ?? 'http://localhost:5173',
    },
    asResponse: true,
  })

  if (!signUpResponse.ok) {
    const error = (await signUpResponse.json()) as { message?: string }
    return c.json(
      { code: 'SIGNUP_FAILED', message: error.message ?? 'Could not create your account.' },
      signUpResponse.status as 400 | 422 | 500,
    )
  }

  const data = (await signUpResponse.json()) as { user?: { id: string } }
  const userId = data.user?.id

  if (userId) {
    await db
      .update(user)
      .set({ tenantId: invite.tenantId, role: invite.role, emailVerified: true })
      .where(eq(user.id, userId))
  }

  await db.update(invitation).set({ status: 'accepted' }).where(eq(invitation.id, invite.id))

  return c.json({ status: 'accepted' }, 201)
})
