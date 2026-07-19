// Queue abstraction from ADR-0006. `schedule()` extends the ADR's original
// enqueue/process pair — recurring cron-like scheduling is a capability all
// three alternatives named there (pg-boss, BullMQ, Temporal) support, and the
// trial-lifecycle scan (issue #43) is the first job that needs it.
export interface Job<T = unknown> {
  name: string
  data: T
}

export interface JobHandler<T = unknown> {
  (job: Job<T>): Promise<void>
}

export interface Queue {
  enqueue<T>(job: Job<T>): Promise<void>
  process<T>(name: string, handler: JobHandler<T>): void
  schedule<T>(name: string, cron: string, data?: T): Promise<void>
}
