# Skill: new-workflow

Scaffold a new lifecycle workflow following the project's event-driven pattern.

## Context

Workflows are automated processes triggered by lifecycle events (`onboarding`, `role_change`, `offboarding`). They orchestrate multiple integration calls via the pg-boss job queue abstraction.

## Steps

1. **Get the workflow name and trigger event** from the user
2. **Create the workflow module** at `apps/api/src/workflows/<workflow-name>/`:

```
apps/api/src/workflows/<workflow-name>/
  index.ts          # exports the workflow
  workflow.ts       # workflow definition and step orchestration
  steps.ts          # individual step implementations
  types.ts          # workflow-specific types
  <workflow>.test.ts
```

3. **Implement the workflow** in `workflow.ts`:

```typescript
export async function run<WorkflowName>Workflow(
  event: LifecycleEvent,
  tenantId: string,
  queue: Queue
): Promise<void> {
  // enqueue steps via the Queue abstraction
}
```

4. **Register the workflow** in `apps/api/src/workflows/registry.ts` and wire it to its trigger event
5. **Add Zod schemas** for workflow input/output to `packages/shared` if exposed via tRPC

## Rules

- Workflows communicate with integrations only via the `Queue` interface — never call integrations directly
- All steps must be idempotent — the queue may retry on failure
- Always pass `tenantId` through every step
- Steps should be small and independently retryable
- Log step start, success, and failure via Pino for observability in Grafana
