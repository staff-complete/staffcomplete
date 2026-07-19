import { and, eq } from 'drizzle-orm'
import type { Context } from 'hono'
import { auth } from '../auth.js'
import { db } from '../db/index.js'
import { member } from '../db/schema.js'

export interface OrgSession {
  userId: string
  organizationId: string
}

// Extracted from invites.ts's requireAdmin, which paired this with a
// role check it doesn't need everywhere — the trial-status route and the
// trial-lock middleware want the session/org resolution without the
// admin-role requirement.
export async function resolveOrgSession(c: Context): Promise<OrgSession | null> {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  const organizationId = result?.session.activeOrganizationId
  if (!result || !organizationId) {
    return null
  }
  return { userId: result.user.id, organizationId }
}

export interface AdminSession {
  user: { id: string }
  organizationId: string
}

// Shared by any route that's admin-only (invites, workflow templates): a
// valid session isn't enough, the member must have 'admin' or 'owner' role
// in their active organization.
export async function requireAdmin(c: Context): Promise<AdminSession | null> {
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
