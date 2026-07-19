import postgres from 'postgres'

// Idempotent: safe to run on every deploy. Grants and ALTER ROLE ... PASSWORD
// both overwrite rather than error on re-run.
//
// Drizzle's schema owns CREATE ROLE (see schema.ts's tenantRole + the migration
// it generated) so the role's existence is versioned. LOGIN and PASSWORD
// aren't part of that migration on purpose — they're set here, from an env
// var, so a real credential never lands in committed SQL. See ADR-0012.

const databaseUrl = process.env.DATABASE_URL
const tenantPassword = process.env.TENANT_POSTGRES_PASSWORD

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}
if (!tenantPassword) {
  throw new Error('TENANT_POSTGRES_PASSWORD environment variable is required')
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')
const sql = postgres(databaseUrl)

// ALTER ROLE ... PASSWORD doesn't accept a bind parameter, so the password is
// escaped via standard SQL string-literal quoting (doubling single quotes)
// rather than interpolated raw. TENANT_POSTGRES_PASSWORD is an operator-generated
// secret, not user input.
const escapedPassword = tenantPassword.replace(/'/g, "''")

await sql.unsafe(`ALTER ROLE "staffcomplete_tenant" WITH LOGIN PASSWORD '${escapedPassword}'`)
await sql.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "staffcomplete_tenant"`)
await sql`GRANT USAGE ON SCHEMA public TO "staffcomplete_tenant"`
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "invitation" TO "staffcomplete_tenant"`
// subscription (0005) was added after this script was first written and
// missed this grant — every withTenant query against it (trial-status route,
// trial-lock middleware) was hitting "permission denied" in any environment
// where this script had already run once (ALTER ROLE only re-applies what's
// listed here, it doesn't pick up new tables automatically).
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "subscription" TO "staffcomplete_tenant"`
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "workflow_template" TO "staffcomplete_tenant"`
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "workflow_template_step" TO "staffcomplete_tenant"`

console.log('staffcomplete_tenant role configured.')

await sql.end()
