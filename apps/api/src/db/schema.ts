import { sql } from 'drizzle-orm'
import { boolean, pgPolicy, pgRole, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Non-superuser role used for tenant-scoped queries (see ADR-0012). LOGIN and
// PASSWORD aren't managed here — apps/api/src/db/setup-app-role.ts handles
// those from an env var so credentials never land in version-controlled SQL.
export const appRole = pgRole('staffcomplete_app', { inherit: true })

export const tenant = pgTable('tenant', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  tenantId: text('tenantId').references(() => tenant.id),
  role: text('role').notNull().default('admin'),
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

export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantId')
      .notNull()
      .references(() => tenant.id),
    email: text('email').notNull(),
    role: text('role').notNull(),
    invitedByUserId: text('invitedByUserId')
      .notNull()
      .references(() => user.id),
    token: text('token').notNull().unique(),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => [
    // Fails closed: current_setting(..., true) returns NULL when unset, so a
    // query that reaches this table outside withTenant() sees zero rows
    // instead of erroring or leaking other tenants' invitations.
    pgPolicy('invitation_tenant_isolation', {
      for: 'all',
      to: appRole,
      using: sql`${table.tenantId} = current_setting('app.tenant_id', true)`,
      withCheck: sql`${table.tenantId} = current_setting('app.tenant_id', true)`,
    }),
  ],
).enableRLS()
