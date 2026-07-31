import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  boolean,
  date,
  integer,
  jsonb,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

// Non-superuser role used for tenant-scoped queries (see ADR-0012). LOGIN and
// PASSWORD aren't managed here — apps/api/src/db/setup-tenant-role.ts handles
// those from an env var so credentials never land in version-controlled SQL.
export const tenantRole = pgRole('staffcomplete_tenant', { inherit: true })

/**
 * The tenant-isolation RLS policy every tenant-scoped table gets: a row is
 * readable and writable only when its `organizationId` matches the
 * transaction's `app.organization_id` (ADR-0012, re-keyed onto
 * `organization.id` by ADR-0014). `withTenant()` in db/index.ts is what sets
 * that variable.
 *
 * Fails closed: `current_setting(..., true)` returns NULL when unset, so a
 * query reaching a tenant-scoped table outside `withTenant()` sees zero rows
 * rather than erroring or leaking another organization's data.
 *
 * Written once here rather than repeated per table. The block was previously
 * copy-pasted ten times verbatim, which is ten chances to typo a policy name
 * or drop `withCheck` — and a missing `withCheck` fails *open* on writes
 * (reads stay isolated, inserts stop being checked), which is exactly the
 * kind of mistake that doesn't announce itself.
 *
 * Note this is only half of what a new tenant-scoped table needs: it also
 * requires an explicit GRANT in setup-tenant-role.ts. See ADR-0017's
 * consequences — that omission has bitten this project twice.
 */
function tenantIsolationPolicy(tableName: string, organizationId: AnyPgColumn) {
  // Built twice rather than shared, so `using` and `withCheck` never hold a
  // reference to the same SQL chunk list.
  const belongsToSessionOrg = () =>
    sql`${organizationId} = current_setting('app.organization_id', true)`

  return pgPolicy(`${tableName}_tenant_isolation`, {
    for: 'all',
    to: tenantRole,
    using: belongsToSessionOrg(),
    withCheck: belongsToSessionOrg(),
  })
}

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('activeOrganizationId'),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// organization/member/invitation replace the hand-rolled tenant/invitation
// tables (ADR-0014) — shape and field names mirror Better Auth's
// `organization` plugin schema exactly, since its Drizzle adapter maps onto
// these tables by field name.
export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  // Org-level UI language (ADR-0016) — every member sees the app in this
  // language, there is no per-user override.
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// One row per organization, created by startTrialIfNeeded on first login
// (ADR-0015). `status` is a reporting-only field — enforcement code must
// independently check `trialEndsAt < now()` rather than trusting `status`,
// since the daily lifecycle job that flips it to 'expired' can lag by up
// to 24h. See ADR-0015 for the full rationale.
export const subscription = pgTable(
  'subscription',
  {
    organizationId: text('organizationId')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('trialing'), // trialing | active | expired | canceled
    plan: text('plan'), // null while trialing; set by issue #45 on subscribe
    trialStartedAt: timestamp('trialStartedAt').notNull(),
    trialEndsAt: timestamp('trialEndsAt').notNull(),
    trialReminderSentAt: timestamp('trialReminderSentAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('subscription', table.organizationId)],
).enableRLS()

export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('pending'),
    inviterId: text('inviterId')
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('invitation', table.organizationId)],
).enableRLS()

// A reusable checklist definition an org builds up-front (issue #22) — the
// template a future run (#23) instantiates for a specific employee. The SQL
// names below still say `workflow_template`: "workflow" was retired as a
// domain term (see CONTEXT.md) after the code had shipped, and renaming the
// tables would be a breaking migration for no user-visible gain. Drizzle maps
// the old SQL name onto the current one — everything above the schema says
// checklist template.
export const checklistTemplate = pgTable(
  'workflow_template',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // onboarding | offboarding
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('workflow_template', table.organizationId)],
).enableRLS()

// Phases within a template. Steps inside a phase can run in parallel; which
// phases are unlocked is driven by the explicit dependency edges in
// checklistTemplatePhaseDependency below (ADR-0019), not by `position` —
// ADR-0017's original "unlocks once the previous phase by position is
// complete" rule no longer applies. `position` is display order only.
export const checklistTemplatePhase = pgTable(
  'workflow_template_phase',
  {
    id: text('id').primaryKey(),
    checklistTemplateId: text('workflowTemplateId')
      .notNull()
      .references(() => checklistTemplate.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through checklistTemplateId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('workflow_template_phase', table.organizationId)],
).enableRLS()

// Explicit phase→phase dependency edges (ADR-0019, extending ADR-0017's
// position-based sequential locking). A phase with no outgoing edges here is
// a root — unlocked as soon as the template/run starts. `position` above is
// kept for display order only; it no longer drives locking.
export const checklistTemplatePhaseDependency = pgTable(
  'workflow_template_phase_dependency',
  {
    id: text('id').primaryKey(),
    phaseId: text('phaseId')
      .notNull()
      .references(() => checklistTemplatePhase.id, { onDelete: 'cascade' }),
    dependsOnPhaseId: text('dependsOnPhaseId')
      .notNull()
      .references(() => checklistTemplatePhase.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through phaseId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.phaseId, table.dependsOnPhaseId),
    tenantIsolationPolicy('workflow_template_phase_dependency', table.organizationId),
  ],
).enableRLS()

export const checklistTemplateStep = pgTable(
  'workflow_template_step',
  {
    id: text('id').primaryKey(),
    checklistTemplateId: text('workflowTemplateId')
      .notNull()
      .references(() => checklistTemplate.id, { onDelete: 'cascade' }),
    phaseId: text('phaseId')
      .notNull()
      .references(() => checklistTemplatePhase.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through checklistTemplateId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type').notNull(), // automated | manual
    assigneeId: text('assigneeId').references(() => member.id, { onDelete: 'set null' }), // manual steps only
    dueDateOffsetDays: integer('dueDateOffsetDays'), // manual steps only
    // automated steps only — a key into packages/shared/src/automation.ts's
    // action registry, plus that action's own parameters. There's no FK to
    // enforce `action` is a real registry key since the registry lives in
    // application code, not the database — packages/shared/src/checklist.ts's
    // createStepSchema is what enforces it at write time.
    action: text('action'),
    config: jsonb('config'),
    position: integer('position').notNull(), // order within the phase
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('workflow_template_step', table.organizationId)],
).enableRLS()

// A checklist template instantiated for a specific employee (issue #25).
// checklistTemplateId is nullable/set-null on delete because employeeName,
// employeeRole, eventDate and `type` are captured here at creation time and
// the steps are copied onto runStep — a run must keep its own history even
// if the template it started from is edited or deleted later.
export const run = pgTable(
  'run',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    checklistTemplateId: text('workflowTemplateId').references(() => checklistTemplate.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(), // onboarding | offboarding
    employeeName: text('employeeName').notNull(),
    employeeEmail: text('employeeEmail').notNull(),
    employeeRole: text('employeeRole').notNull(),
    eventDate: date('eventDate').notNull(), // onboarding start date / offboarding last day
    status: text('status').notNull().default('pending'), // pending | in_progress | completed
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('run', table.organizationId)],
).enableRLS()

// Ordered phases within a run, copied from checklistTemplatePhase at run
// creation time (same reasoning as why runStep copies checklistTemplateStep —
// a run must keep its own history even if the template changes later).
export const runPhase = pgTable(
  'run_phase',
  {
    id: text('id').primaryKey(),
    runId: text('runId')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through runId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [tenantIsolationPolicy('run_phase', table.organizationId)],
).enableRLS()

// Run-side mirror of checklistTemplatePhaseDependency (ADR-0019), copied from
// it at run creation time — same reasoning as runPhase vs.
// checklistTemplatePhase: a run keeps its own history even if the template's
// dependencies are edited or deleted later.
export const runPhaseDependency = pgTable(
  'run_phase_dependency',
  {
    id: text('id').primaryKey(),
    phaseId: text('phaseId')
      .notNull()
      .references(() => runPhase.id, { onDelete: 'cascade' }),
    dependsOnPhaseId: text('dependsOnPhaseId')
      .notNull()
      .references(() => runPhase.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through phaseId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.phaseId, table.dependsOnPhaseId),
    tenantIsolationPolicy('run_phase_dependency', table.organizationId),
  ],
).enableRLS()

export const runStep = pgTable(
  'run_step',
  {
    id: text('id').primaryKey(),
    runId: text('runId')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    phaseId: text('phaseId')
      .notNull()
      .references(() => runPhase.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through runId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type').notNull(), // automated | manual
    assigneeId: text('assigneeId').references(() => member.id, { onDelete: 'set null' }), // manual steps only
    dueDateOffsetDays: integer('dueDateOffsetDays'), // manual steps only
    // automated steps only — see the matching comment on checklistTemplateStep.
    action: text('action'),
    config: jsonb('config'),
    status: text('status').notNull().default('pending'), // pending | completed
    position: integer('position').notNull(), // order within the phase
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    // Set only when status flips to 'completed' (issue #86's activity feed
    // needs a real completion timestamp — createdAt is when the run started,
    // not when the step finished).
    completedAt: timestamp('completedAt'),
  },
  (table) => [tenantIsolationPolicy('run_step', table.organizationId)],
).enableRLS()
