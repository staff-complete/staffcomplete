# ADR-0006: Job Queue

- **Status:** accepted
- **Date:** 2026-06-27

## Context

Lifecycle events (onboarding, offboarding, role changes) trigger multi-step async jobs — provisioning access, sending notifications, calling external APIs. These jobs need retries, delays, and failure handling.

## Decision

Use **pg-boss** — a PostgreSQL-backed job queue. Jobs are stored in a dedicated table in the existing PostgreSQL database. No additional infrastructure (Redis, RabbitMQ) is required.

pg-boss is wrapped behind a queue abstraction interface in `packages/shared`:

```typescript
interface Queue {
  enqueue(job: Job): Promise<void>
  process(handler: JobHandler): void
}
```

Application code depends on the interface, not pg-boss directly.

## Consequences

- No extra infrastructure to operate or monitor at this stage
- The abstraction interface allows swapping to BullMQ, Temporal, or a managed workflow service without changing application code — only the adapter changes
- pg-boss throughput is sufficient for small/mid-size customer volumes; revisit if job volume exceeds tens of thousands per minute
