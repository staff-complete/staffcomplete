import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { computeTrialState } from '@staffcomplete/shared'
import { withTenant } from '../db/index.js'
import { subscription } from '../db/schema.js'
import { resolveOrgSession } from '../lib/session.js'

export const billingRouter = new Hono()

// Every member sees the countdown, not just admins — unlike invitesRouter's
// requireAdmin, this only needs a session, not a role check.
billingRouter.get('/trial-status', async (c) => {
  const session = await resolveOrgSession(c)
  if (!session) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Sign in required.' }, 401)
  }

  const sub = await withTenant(session.organizationId, (tx) =>
    tx.query.subscription.findFirst({
      where: eq(subscription.organizationId, session.organizationId),
    }),
  )
  if (!sub) {
    return c.json(
      { code: 'NOT_FOUND', message: 'No subscription found for this organization.' },
      404,
    )
  }

  const { daysRemaining, isExpired } = computeTrialState(sub.trialEndsAt)
  // Mirrors the trial-lock middleware's enforcement rule (ADR-0015): an
  // 'active'/'canceled' subscription is never read-only from a stale
  // trialEndsAt, only from status: 'expired'.
  const isReadOnly = sub.status === 'expired' || (sub.status === 'trialing' && isExpired)

  return c.json({
    status: sub.status,
    trialEndsAt: sub.trialEndsAt.toISOString(),
    daysRemaining,
    isReadOnly,
  })
})
