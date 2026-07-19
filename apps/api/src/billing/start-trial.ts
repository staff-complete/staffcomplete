import { addDays } from 'date-fns'
import { withTenant } from '../db/index.js'
import { subscription } from '../db/schema.js'

// Runs on every login (not just the first), so idempotency is enforced by
// the database via onConflictDoNothing keyed on the primary key, not by
// application logic guessing "is this the first login" (ADR-0015).
export async function startTrialIfNeeded(organizationId: string): Promise<void> {
  const now = new Date()
  const trialEndsAt = addDays(now, 14)
  await withTenant(organizationId, (tx) =>
    tx
      .insert(subscription)
      .values({ organizationId, status: 'trialing', trialStartedAt: now, trialEndsAt })
      .onConflictDoNothing({ target: subscription.organizationId }),
  )
}
