import { and, eq, inArray } from 'drizzle-orm'
import { computeTrialState } from '@staffcomplete/shared'
import { escapeHtml, sendAuthEmail } from '../auth.js'
import { db } from '../db/index.js'
import { member, organization, subscription, user } from '../db/schema.js'

const REMINDER_WINDOW_DAYS = 3

// Cross-tenant by design: this is a system scan over every trialing
// organization, not a request scoped to one tenant — the same category of
// access ADR-0012 carved out for the invite system's public token lookups.
// Queries the plain `db` connection (superuser), not withTenant/tenantDb.
// See ADR-0015 for why `status` is only updated here, never trusted for
// enforcement.
export async function runTrialLifecycleScan(): Promise<void> {
  let trialingOrgs: Awaited<ReturnType<typeof db.query.subscription.findMany>>
  try {
    trialingOrgs = await db.query.subscription.findMany({
      where: eq(subscription.status, 'trialing'),
    })
  } catch (err) {
    console.error('trial-lifecycle-scan failed to fetch trialing organizations', err)
    return
  }

  for (const sub of trialingOrgs) {
    try {
      await processOrgTrial(sub)
    } catch (err) {
      // One org's failure (DB hiccup, email provider outage) must not stop
      // the rest of the scan from running.
      console.error(`trial-lifecycle-scan failed for org ${sub.organizationId}`, err)
    }
  }
}

async function processOrgTrial(sub: {
  organizationId: string
  trialEndsAt: Date
  trialReminderSentAt: Date | null
}): Promise<void> {
  const { isExpired, daysRemaining } = computeTrialState(sub.trialEndsAt)

  if (isExpired) {
    await db
      .update(subscription)
      .set({ status: 'expired' })
      .where(eq(subscription.organizationId, sub.organizationId))
    return
  }

  // <= rather than an exact 3-day match, so a delayed or skipped run still
  // catches up before the trial fully expires.
  if (sub.trialReminderSentAt || daysRemaining > REMINDER_WINDOW_DAYS) {
    return
  }

  await sendTrialReminderEmail(sub.organizationId)
  // Mark sent immediately after this org's send succeeds, before moving to
  // the next org, so a mid-scan crash or a second run that day can't
  // double-send.
  await db
    .update(subscription)
    .set({ trialReminderSentAt: new Date() })
    .where(eq(subscription.organizationId, sub.organizationId))
}

async function sendTrialReminderEmail(organizationId: string): Promise<void> {
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
    columns: { name: true },
  })
  const admins = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, organizationId), inArray(member.role, ['admin', 'owner'])))

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const billingUrl = `${appUrl}/billing`
  const companyName = escapeHtml(org?.name ?? 'your organization')

  await Promise.all(
    admins.map(({ email }) =>
      sendAuthEmail(
        email,
        'Your StaffComplete trial ends in 3 days',
        `
          <p>Your trial for <strong>${companyName}</strong> on StaffComplete ends in 3 days.</p>
          <p><a href="${billingUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Add a payment method</a></p>
          <p>After the trial ends, StaffComplete switches to a read-only view until you subscribe.</p>
        `,
      ),
    ),
  )
}
