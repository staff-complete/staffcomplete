import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { APIError } from 'better-auth/api'
import { auth } from '../auth.js'
import { db, withTenant } from '../db/index.js'
import { invitation, member, organization, user } from '../db/schema.js'
import { resolveOrgSession } from '../lib/session.js'
import { blockMutationsWhenExpired } from '../middleware/trial-lock.js'

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'member']),
})

const acceptInviteSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
})

type AdminSession = { user: { id: string }; organizationId: string }

async function requireAdmin(c: Context): Promise<AdminSession | null> {
  const session = await resolveOrgSession(c)
  if (!session) {
    return null
  }

  const membership = await db.query.member.findFirst({
    where: and(
      eq(member.userId, session.userId),
      eq(member.organizationId, session.organizationId),
    ),
    columns: { role: true },
  })
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return null
  }

  return { user: { id: session.userId }, organizationId: session.organizationId }
}

export const invitesRouter = new Hono()

invitesRouter.get('/', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  // No explicit organizationId filter: the invitation_tenant_isolation RLS
  // policy (ADR-0012, re-keyed by ADR-0014) already scopes every row to
  // session.organizationId via withTenant's set_config — adding one here
  // would just mask a broken policy instead of letting it fail loudly.
  const invites = await withTenant(session.organizationId, (tx) =>
    tx.query.invitation.findMany({
      where: eq(invitation.status, 'pending'),
      columns: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
  )

  return c.json({ invites })
})

invitesRouter.post(
  '/',
  zValidator('json', inviteSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const { email, role } = c.req.valid('json')

    try {
      // The plugin's own invite flow (ADR-0014) already handles same-org
      // duplicate-member and pending-invite de-duplication, and — the entire
      // point of this ADR — raises no error at all when the email belongs to
      // an account in a *different* organization, since that's now a normal,
      // fully-supported invite instead of an enumeration risk to route around.
      await auth.api.createInvitation({
        headers: c.req.raw.headers,
        body: { email, role, organizationId: session.organizationId },
      })
    } catch (err) {
      const code =
        err instanceof APIError ? (err.body as { code?: string } | undefined)?.code : undefined
      if (code === 'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION') {
        return c.json(
          { code: 'ALREADY_MEMBER', message: 'This person is already a member of your team.' },
          409,
        )
      }
      if (code === 'USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION') {
        return c.json(
          { code: 'INVITE_PENDING', message: 'An invite is already pending for this email.' },
          409,
        )
      }
      return c.json(
        { code: 'INVITE_FAILED', message: 'Could not send the invite. Please try again.' },
        500,
      )
    }

    return c.json({ status: 'invited' }, 201)
  },
)

invitesRouter.delete('/:id', blockMutationsWhenExpired(), async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const id = c.req.param('id')
  const pending = await withTenant(session.organizationId, (tx) =>
    tx.query.invitation.findFirst({
      where: and(eq(invitation.id, id), eq(invitation.status, 'pending')),
      columns: { id: true },
    }),
  )
  if (!pending) {
    return c.json({ code: 'NOT_FOUND', message: 'Invite not found.' }, 404)
  }

  await auth.api.cancelInvitation({
    headers: c.req.raw.headers,
    body: { invitationId: id },
  })

  return c.json({ status: 'revoked' })
})

invitesRouter.get('/:token', async (c) => {
  const token = c.req.param('token')
  const invite = await db.query.invitation.findFirst({ where: eq(invitation.id, token) })

  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return c.json(
      { code: 'INVALID_INVITE', message: 'This invite link is invalid or has expired.' },
      404,
    )
  }

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, invite.organizationId),
    columns: { name: true },
  })
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, invite.email),
    columns: { id: true },
  })
  const currentSession = await auth.api.getSession({ headers: c.req.raw.headers })
  const sessionMatches = currentSession?.user.email.toLowerCase() === invite.email.toLowerCase()

  return c.json({
    email: invite.email,
    role: invite.role,
    organizationName: org?.name ?? null,
    // Lets the frontend distinguish "set a password to create your
    // account" from "you already have an account — sign in to accept"
    // (ADR-0014's whole point: a second organization no longer requires a
    // second account).
    accountExists: !!existingUser,
    sessionMatches,
  })
})

invitesRouter.post('/:token/accept', zValidator('json', acceptInviteSchema), async (c) => {
  const token = c.req.param('token')
  const body = c.req.valid('json')

  const invite = await db.query.invitation.findFirst({ where: eq(invitation.id, token) })
  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return c.json(
      { code: 'INVALID_INVITE', message: 'This invite link is invalid or has expired.' },
      404,
    )
  }

  const currentSession = await auth.api.getSession({ headers: c.req.raw.headers })

  // Already signed in as the invited email (the cross-org case ADR-0014
  // exists for): delegate straight to the plugin's own accept flow rather
  // than reimplementing membership/limit checks it already does.
  if (currentSession?.user.email.toLowerCase() === invite.email.toLowerCase()) {
    try {
      await auth.api.acceptInvitation({
        headers: c.req.raw.headers,
        body: { invitationId: token },
      })
    } catch (err) {
      const message =
        err instanceof APIError ? err.message : 'Could not accept the invite. Please try again.'
      return c.json({ code: 'ACCEPT_FAILED', message }, 400)
    }
    return c.json({ status: 'accepted' }, 201)
  }

  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, invite.email),
    columns: { id: true },
  })
  if (existingUser) {
    // Can't silently create a second account for this email (Better Auth's
    // email-uniqueness constraint would reject it anyway) — send them to
    // sign in first, then revisit this same link to accept.
    return c.json(
      {
        code: 'ACCOUNT_EXISTS',
        message: 'You already have an account for this email. Sign in to accept the invite.',
      },
      409,
    )
  }

  const { name, password } = body
  if (!name || !password) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'Name and password are required.' }, 400)
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
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: invite.organizationId,
      userId,
      role: invite.role,
    })
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId))
  }

  await db.update(invitation).set({ status: 'accepted' }).where(eq(invitation.id, invite.id))

  return c.json({ status: 'accepted' }, 201)
})
