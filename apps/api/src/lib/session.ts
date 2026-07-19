import type { Context } from 'hono'
import { auth } from '../auth.js'

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
