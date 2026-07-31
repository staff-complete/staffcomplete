import { and, eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { computeTrialState } from '@staffcomplete/shared'
import { db, withTenant } from '../db/index.js'
import { member, subscription } from '../db/schema.js'
import { resolveOrgSession } from '../lib/session.js'

// What every org-scoped handler needs about its caller, resolved once per
// request and read back via c.get('orgAuth').
//
// `membership` is null when the session's active organization has no member
// row for this user — anomalous, but routes disagree on what it means, so
// the middleware reports it rather than deciding: admin routes reject it
// (orgAuth({ admin: true }) below), while GET /api/tasks/mine treats it as
// "no tasks assigned to you" and returns an empty list.
export interface OrgAuth {
  userId: string
  organizationId: string
  // member.id, not user.id — runStep.assigneeId references the former.
  membership: { id: string; role: string } | null
}

declare module 'hono' {
  interface ContextVariableMap {
    orgAuth: OrgAuth
  }
}

interface OrgAuthOptions {
  // Require a membership whose role in the active organization is admin or
  // owner. A caller who fails this gets the same 403 as one with no session
  // at all — the previous requireAdmin() collapsed both cases too, and
  // distinguishing them would tell an unauthenticated caller that the route
  // exists and is admin-only.
  admin?: boolean
}

// Single gate for org-scoped routes: resolves the session, the caller's
// membership, and (on mutations) the org's trial state in one pass, then
// stashes the result on the context.
//
// Replaces requireAdmin() + blockMutationsWhenExpired(), which each resolved
// the session independently — a mutating admin request used to call
// auth.api.getSession twice and open two separate transactions before the
// handler did any work. The membership and subscription lookups hit
// different pools (db vs tenantDb, see ADR-0012), so they can't be one
// query, but they don't depend on each other and run concurrently.
export function orgAuth(options: OrgAuthOptions = {}): MiddlewareHandler {
  const forbiddenMessage = options.admin ? 'Admin access required.' : 'Sign-in required.'

  return async (c, next) => {
    const session = await resolveOrgSession(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: forbiddenMessage }, 403)
    }

    // Reads are always allowed — "read-only" means viewable, not locked out
    // (ADR-0015) — so the subscription lookup is skipped entirely on GET.
    const needsTrialCheck = c.req.method !== 'GET' && c.req.method !== 'HEAD'

    const [membership, sub] = await Promise.all([
      db.query.member.findFirst({
        where: and(
          eq(member.userId, session.userId),
          eq(member.organizationId, session.organizationId),
        ),
        columns: { id: true, role: true },
      }),
      needsTrialCheck
        ? withTenant(session.organizationId, (tx) =>
            tx.query.subscription.findFirst({
              where: eq(subscription.organizationId, session.organizationId),
            }),
          )
        : undefined,
    ])

    if (
      options.admin &&
      (!membership || (membership.role !== 'admin' && membership.role !== 'owner'))
    ) {
      return c.json({ code: 'FORBIDDEN', message: forbiddenMessage }, 403)
    }

    // Per ADR-0015, a 'trialing' row past its trialEndsAt is treated as
    // expired even though the daily lifecycle job hasn't flipped `status`
    // yet; a row already 'active' (subscribed) or 'canceled' is never locked
    // by this stale trialEndsAt check — only status: 'expired' locks those.
    const isLocked =
      !!sub &&
      (sub.status === 'expired' ||
        (sub.status === 'trialing' && computeTrialState(sub.trialEndsAt).isExpired))

    if (isLocked) {
      return c.json(
        { code: 'TRIAL_EXPIRED', message: 'Your trial has ended. Subscribe to continue.' },
        402,
      )
    }

    c.set('orgAuth', {
      userId: session.userId,
      organizationId: session.organizationId,
      membership: membership ?? null,
    })

    return next()
  }
}
