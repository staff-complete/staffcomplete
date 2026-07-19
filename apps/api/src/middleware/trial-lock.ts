import { eq } from 'drizzle-orm'
import type { MiddlewareHandler } from 'hono'
import { computeTrialState } from '@staffcomplete/shared'
import { withTenant } from '../db/index.js'
import { subscription } from '../db/schema.js'
import { resolveOrgSession } from '../lib/session.js'

// Reads are always allowed — "read-only" means viewable, not locked out.
// Per ADR-0015, a 'trialing' row past its trialEndsAt is treated as
// expired even though the daily lifecycle job hasn't flipped `status`
// yet; a row already 'active' (subscribed) or 'canceled' is never locked
// by this stale trialEndsAt check — only status: 'expired' locks those.
export function blockMutationsWhenExpired(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD') {
      return next()
    }

    const session = await resolveOrgSession(c)
    if (!session) {
      return next()
    }

    const sub = await withTenant(session.organizationId, (tx) =>
      tx.query.subscription.findFirst({
        where: eq(subscription.organizationId, session.organizationId),
      }),
    )

    const isLocked =
      !!sub &&
      (sub.status === 'expired' ||
        (sub.status === 'trialing' && computeTrialState(sub.trialEndsAt).isExpired))

    if (isLocked) {
      return c.json(
        {
          code: 'TRIAL_EXPIRED',
          message: 'Your trial has ended. Subscribe to continue.',
        },
        402,
      )
    }

    return next()
  }
}
