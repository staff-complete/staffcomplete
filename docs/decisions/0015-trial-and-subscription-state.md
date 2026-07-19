# ADR-0015: Trial and Subscription State Model

- **Status:** accepted
- **Date:** 2026-07-19

## Context

Issue #43 requires every new organization to get a 14-day full-access
trial automatically on first login, with a countdown banner, a 3-day
reminder email, and a read-only lock on expiry — all before any billing
integration exists. Four more ready issues (#44 view plan/usage/billing,
#45 subscribe to a plan, #46 soft overage alert, #47 auto-upgrade on hard
overage) will all read and write the same underlying state shortly after.
No table or column for plan, billing, or trial state exists anywhere in
the schema today, so this is a from-scratch design, not an extension of
something established.

Two constraints came from the existing schema and prior ADRs:

- `organization` (`apps/api/src/db/schema.ts`) is explicitly shaped to
  match Better Auth's `organization` plugin adapter field-for-field
  (ADR-0014) — its Drizzle adapter maps onto that table by name. Adding
  unrelated billing columns to it couples billing state to a third-party
  plugin's schema contract.
- `organization` carries no RLS policy — per ADR-0012 it's the tenant
  root, not tenant-_scoped_ data, so it was never a policy candidate.
  Trial/billing state, in contrast, is genuinely tenant-scoped and should
  be protected the same way `invitation` is.

## Decision

Add a dedicated `subscription` table, one row per organization
(`organizationId` as primary key, `references organization.id`), rather
than columns on `organization`:

```ts
export const subscription = pgTable(
  'subscription',
  {
    organizationId: text('organizationId')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('trialing'), // trialing | active | expired | canceled
    plan: text('plan'), // null while trialing; set by #45 on subscribe
    trialStartedAt: timestamp('trialStartedAt').notNull(),
    trialEndsAt: timestamp('trialEndsAt').notNull(),
    trialReminderSentAt: timestamp('trialReminderSentAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('subscription_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
).enableRLS()
```

This follows the exact `invitation` pattern from ADR-0012/ADR-0014:
`tenantRole` + `pgPolicy` keyed on `current_setting('app.organization_id', true)`,
queried through `withTenant()` from request-scoped code.

**State machine:** `trialing → active` or `trialing → canceled` (owned by
#45's Stripe webhook), and `trialing → expired` (owned by the daily job
this issue adds, `apps/api/src/jobs/trial-lifecycle-scan.ts`). `active`/
`canceled` transitions and populating `plan`/Stripe fields are explicitly
out of scope for #43 and belong to #45.

**Enforcement rule — this is the load-bearing part of this ADR.** The
daily lifecycle job is the only thing that writes `status = 'expired'`,
so `status` can lag real time by up to 24 hours. Any code that decides
whether to lock an organization out (API middleware, the frontend banner)
must **never trust `status` alone** — it must independently compare
`trialEndsAt < now()`, treating a `trialing` row past its `trialEndsAt`
as already expired regardless of what `status` says. `status` exists so
reporting code can filter on it (e.g. #44's billing view doing
`WHERE status = 'expired'`), not as the enforcement authority. A future
implementer extending this table who assumes `status` alone is
authoritative will build a 24-hour trust-window bug — this rule is
written down here specifically so #44–#47 don't have to rediscover it.

**Cross-tenant access, by design, in two places:** the trial-start hook
(on `session.create`) and the daily lifecycle scan both need to
read/write `subscription` rows without an authenticated tenant context in
hand — the same category of access ADR-0012 already carved out for the
invite system's public token-based endpoints. Both use the plain `db`
connection (superuser, `DATABASE_URL`), not `withTenant`/`tenantDb`, and
each call site carries a comment citing this ADR and ADR-0012 rather than
restating the reasoning.

**Alternative considered:** columns on `organization`. Rejected per the
two constraints in Context — it would couple billing state to Better
Auth's adapter contract and require either giving the tenant-root table
RLS (a bigger change with no other motivation) or leaving billing data
unprotected by RLS.

## Consequences

- `subscription` is a shared contract for four other ready issues: #44
  reads it for the billing view, #45 owns moving `status` to `active` and
  populating `plan` + Stripe identifiers (which will need new columns
  added to this table, not a new one), #46 extends it with
  headcount/usage fields, #47 owns auto-upgrade. It's built now to be
  extended, not rebuilt.
- Every future reader of trial/lock state must apply the lazy
  `trialEndsAt`-vs-`status` rule above; this can't be enforced by types,
  only by convention and this document.
- Two more call sites (trial-start hook, lifecycle scan) now read/write
  `subscription` on the superuser connection instead of through
  `withTenant`, growing the set of intentional RLS-bypass points ADR-0012
  already flagged as needing explicit, case-by-case justification rather
  than being assumed safe by default.
