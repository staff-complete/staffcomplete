import { PgBoss } from 'pg-boss'
import type { Queue } from '@staffcomplete/shared'
import { PgBossQueue } from './pg-boss-queue.js'

// pg-boss manages its own schema/tables and needs to create them, which the
// restricted staffcomplete_tenant role (ADR-0012) can't do — connect as the
// superuser, same connection apps/api/src/db/index.ts's plain `db` uses.
// Constructing PgBoss doesn't open a connection by itself (mirrors the
// `postgres()` client in db/index.ts), so this is safe at module load time.
const boss = new PgBoss(process.env.DATABASE_URL ?? 'postgres://localhost:5432/staffcomplete')

export const queue: Queue = new PgBossQueue(boss)

export async function startQueue(): Promise<void> {
  await boss.start()
}

export async function stopQueue(): Promise<void> {
  await boss.stop()
}
