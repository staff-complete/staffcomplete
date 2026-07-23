import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  integer,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// Non-superuser role used for tenant-scoped queries (see ADR-0012). LOGIN and
// PASSWORD aren't managed here — apps/api/src/db/setup-tenant-role.ts handles
// those from an env var so credentials never land in version-controlled SQL.
export const tenantRole = pgRole('staffcomplete_tenant', { inherit: true })

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
  (table) => [
    pgPolicy('subscription_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
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
  (table) => [
    // Fails closed: current_setting(..., true) returns NULL when unset, so a
    // query that reaches this table outside withTenant() sees zero rows
    // instead of erroring or leaking other organizations' invitations.
    pgPolicy('invitation_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
).enableRLS()

// A reusable checklist definition an org builds up-front (issue #22) — the
// template a future run (#23) instantiates for a specific employee. Named
// `workflowTemplate` rather than `workflow` to avoid colliding with the
// separate runtime workflow-engine concept (apps/api/src/workflows/<name>/).
export const workflowTemplate = pgTable(
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
  (table) => [
    pgPolicy('workflow_template_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
).enableRLS()

export const workflowTemplateStep = pgTable(
  'workflow_template_step',
  {
    id: text('id').primaryKey(),
    workflowTemplateId: text('workflowTemplateId')
      .notNull()
      .references(() => workflowTemplate.id, { onDelete: 'cascade' }),
    // Denormalized per ADR-0005 ("every tenant-scoped table must have a
    // tenant_id column") — RLS policies can't join through workflowTemplateId.
    organizationId: text('organizationId')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type').notNull(), // automated | manual
    assigneeId: text('assigneeId').references(() => member.id, { onDelete: 'set null' }),
    dueDateOffsetDays: integer('dueDateOffsetDays'), // manual steps only
    position: integer('position').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    pgPolicy('workflow_template_step_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
).enableRLS()

// A workflow template instantiated for a specific employee (issue #25).
// workflowTemplateId is nullable/set-null on delete because employeeName,
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
    workflowTemplateId: text('workflowTemplateId').references(() => workflowTemplate.id, {
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
  (table) => [
    pgPolicy('run_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
).enableRLS()

export const runStep = pgTable(
  'run_step',
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
    title: text('title').notNull(),
    type: text('type').notNull(), // automated | manual
    assigneeId: text('assigneeId').references(() => member.id, { onDelete: 'set null' }),
    dueDateOffsetDays: integer('dueDateOffsetDays'), // manual steps only
    status: text('status').notNull().default('pending'), // pending | completed
    position: integer('position').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    // Set only when status flips to 'completed' (issue #86's activity feed
    // needs a real completion timestamp — createdAt is when the run started,
    // not when the step finished).
    completedAt: timestamp('completedAt'),
  },
  (table) => [
    pgPolicy('run_step_tenant_isolation', {
      for: 'all',
      to: tenantRole,
      using: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
      withCheck: sql`${table.organizationId} = current_setting('app.organization_id', true)`,
    }),
  ],
).enableRLS()
