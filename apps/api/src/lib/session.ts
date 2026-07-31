import type { Context } from 'hono'
import { auth } from '../auth.js'

export interface OrgSession {
  userId: string
  organizationId: string
}

// Resolves just "who is calling, and which organization are they in" — no
// membership or role lookup. The orgAuth middleware builds on this for
// org-scoped routes; billing's trial-status route uses it directly, since
// it needs neither a role check nor a member id.
export async function resolveOrgSession(c: Context): Promise<OrgSession | null> {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  const organizationId = result?.session.activeOrganizationId
  if (!result || !organizationId) {
    return null
  }
  return { userId: result.user.id, organizationId }
}
