import type { PgBoss } from 'pg-boss'
import type { Job, JobHandler, Queue } from '@staffcomplete/shared'

// pg-boss requires a queue to exist (createQueue) before send/work/schedule
// will accept it — createQueue is safe to call repeatedly (it's a create-if-
// missing operation), so each method below calls it first rather than
// pushing that requirement onto every caller.
export class PgBossQueue implements Queue {
  #boss: PgBoss

  constructor(boss: PgBoss) {
    this.#boss = boss
  }

  async enqueue<T>(job: Job<T>): Promise<void> {
    await this.#boss.createQueue(job.name)
    await this.#boss.send(job.name, (job.data ?? null) as object | null)
  }

  process<T>(name: string, handler: JobHandler<T>): void {
    void this.#boss.createQueue(name).then(() =>
      this.#boss.work<T>(name, async ([job]) => {
        await handler({ name, data: job.data })
      }),
    )
  }

  async schedule<T>(name: string, cron: string, data?: T): Promise<void> {
    await this.#boss.createQueue(name)
    await this.#boss.schedule(name, cron, (data ?? null) as object | null)
  }
}
