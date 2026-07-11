import postgres from 'postgres'

// Idempotent: safe to run on every deploy. Grants and ALTER ROLE ... PASSWORD
// both overwrite rather than error on re-run.
//
// Drizzle's schema owns CREATE ROLE (see schema.ts's appRole + the migration
// it generated) so the role's existence is versioned. LOGIN and PASSWORD
// aren't part of that migration on purpose — they're set here, from an env
// var, so a real credential never lands in committed SQL. See ADR-0012.

const databaseUrl = process.env.DATABASE_URL
const appDbPassword = process.env.TENANT_DB_PASSWORD

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}
if (!appDbPassword) {
  throw new Error('TENANT_DB_PASSWORD environment variable is required')
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')
const sql = postgres(databaseUrl)

// ALTER ROLE ... PASSWORD doesn't accept a bind parameter, so the password is
// escaped via standard SQL string-literal quoting (doubling single quotes)
// rather than interpolated raw. TENANT_DB_PASSWORD is an operator-generated
// secret, not user input.
const escapedPassword = appDbPassword.replace(/'/g, "''")

await sql.unsafe(`ALTER ROLE "staffcomplete_app" WITH LOGIN PASSWORD '${escapedPassword}'`)
await sql.unsafe(`GRANT CONNECT ON DATABASE "${databaseName}" TO "staffcomplete_app"`)
await sql`GRANT USAGE ON SCHEMA public TO "staffcomplete_app"`
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON "invitation" TO "staffcomplete_app"`

console.log('staffcomplete_app role configured.')

await sql.end()
