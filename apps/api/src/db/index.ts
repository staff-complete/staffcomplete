import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://localhost:5432/staffcomplete', {
  max: 10,
  idle_timeout: 20,
})

export const db = drizzle(sql, { schema })
