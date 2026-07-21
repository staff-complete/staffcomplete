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

try {
  await sql.unsafe(`ALTER ROLE "staffcomplete_tenant" WITH LOGIN PASSWORD '${escapedPassword}'`)
} catch (error) {
  // Deliberately don't rethrow (or attach as `cause`) the original error:
  // it wraps this exact query, real password included, and postgres.js
  // only keeps that off the enumerable surface — i.e. out of default error
  // logging — while its `debug` option is off (see connection.js's
  // queryError). TENANT_POSTGRES_PASSWORD isn't its own GitHub secret (it's
  // derived at deploy time from TENANT_DATABASE_URL), so unlike the other
  // deploy secrets, nothing would auto-redact it from the log if it ever
  // did surface. Re-throwing only the safe bits means a future `debug: true`
  // flip on this connection can't turn this into a credential leak.
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && 'code' in error ? ` (${error.code})` : ''
  throw new Error(`Failed to set staffcomplete_tenant role password: ${message}${code}`)
}
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
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "run" TO "staffcomplete_tenant"`
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "run_step" TO "staffcomplete_tenant"`

console.log('staffcomplete_tenant role configured.')

await sql.end()
