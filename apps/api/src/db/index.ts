import { sql as rawSql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://localhost:5432/staffcomplete', {
  max: 10,
  idle_timeout: 20,
})

export const db = drizzle(sql, { schema })

// Connects as the restricted staffcomplete_tenant role (no BYPASSRLS) — see
// ADR-0012. Only reach for this via withTenant() below; a bare tenantDb
// query outside a transaction that sets app.tenant_id sees zero rows.
//
// No fallback here on purpose, unlike DATABASE_URL above: this connection's
// entire job is to authenticate as a different, more restricted role than
// the default one. A silently-reused default (previously the same literal
// string as DATABASE_URL's fallback) doesn't degrade gracefully — it just
// masks a missing config value that RLS isolation depends on.
const tenantDatabaseUrl = process.env.TENANT_DATABASE_URL
if (!tenantDatabaseUrl) {
  throw new Error('TENANT_DATABASE_URL environment variable is required')
}

const tenantSql = postgres(tenantDatabaseUrl, {
  max: 10,
  idle_timeout: 20,
})

export const tenantDb = drizzle(tenantSql, { schema })

/**
 * Runs `fn` inside a transaction with Postgres session var
 * `app.organization_id` set to `organizationId`, so RLS policies scoped to
 * that setting apply. Use for any query against a tenant-scoped table that
 * should only see/touch rows belonging to a known, already-authenticated
 * organization (ADR-0014 re-keyed RLS off `organization.id`).
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: Parameters<Parameters<typeof tenantDb.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return tenantDb.transaction(async (tx) => {
    await tx.execute(rawSql`select set_config('app.organization_id', ${organizationId}, true)`)
    return fn(tx)
  })
}
