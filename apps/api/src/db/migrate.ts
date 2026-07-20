import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// drizzle-kit's `migrate` CLI command has no verbose/debug flag, and its
// progress spinner silently drops the real error on failure instead of
// printing it — confirmed by capturing its raw output straight to a file,
// bypassing any pipe/TTY truncation, and seeing the exact same cutoff. This
// calls drizzle-orm's migrator directly instead, so a failure's actual
// cause (connection, auth, SQL) reaches the deploy log.

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

// A single connection is drizzle-orm's documented recommendation for
// running migrations (no pooling needed for a one-shot sequential apply).
const sql = postgres(databaseUrl, { max: 1 })
const db = drizzle(sql)

try {
  await migrate(db, { migrationsFolder: './src/db/migrations' })
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await sql.end()
}
