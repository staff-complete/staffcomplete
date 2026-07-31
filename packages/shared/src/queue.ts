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

// Options for one-off jobs that need retry-on-failure or dedup semantics
// (e.g. executing an automated checklist step) — plain fields rather than a
// generic pass-through bag, so callers stay decoupled from pg-boss's own
// option shape per ADR-0006.
export interface EnqueueOptions {
  // Refuses a second active/queued job with the same key on the same queue —
  // used to prevent double-dispatching the same run step if two completions
  // race to unlock the same phase.
  singletonKey?: string
  retryLimit?: number
  retryBackoff?: boolean
}

export interface Queue {
  enqueue<T>(job: Job<T>, options?: EnqueueOptions): Promise<void>
  process<T>(name: string, handler: JobHandler<T>): void
  schedule<T>(name: string, cron: string, data?: T): Promise<void>
}
