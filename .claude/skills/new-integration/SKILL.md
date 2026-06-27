# Skill: new-integration

Scaffold a new external system integration following the project's integration pattern.

## Context

Integrations connect the platform to external SaaS tools (Google Workspace, Slack, GitHub, AWS, etc.). They are triggered by lifecycle events (onboarding, role_change, offboarding) via the job queue.

## Steps

1. **Get the integration name** from the user (e.g. "Google Workspace", "Slack", "GitHub")
2. **Derive the module name** — kebab-case (e.g. `google-workspace`, `slack`, `github`)
3. **Create the integration module** at `apps/api/src/integrations/<module-name>/`:

```
apps/api/src/integrations/<module-name>/
  index.ts          # exports the integration
  client.ts         # API client / SDK wrapper
  handlers.ts       # lifecycle event handlers
  types.ts          # integration-specific types
  <module>.test.ts  # Vitest unit tests
```

4. **Implement the standard interface** in `handlers.ts`:

```typescript
export interface IntegrationHandlers {
  onboard(employee: Employee, tenantId: string): Promise<void>
  offboard(employee: Employee, tenantId: string): Promise<void>
  roleChange(employee: Employee, previousRole: string, tenantId: string): Promise<void>
}
```

5. **Register the integration** in `apps/api/src/integrations/registry.ts`
6. **Add environment variables** to `.env.example` for any required API keys or credentials
7. **Suggest an ADR** if this integration involves a non-obvious architectural decision

## Rules

- Never hardcode credentials — use environment variables via dotenv
- All handlers receive `tenantId` — pass it through to any tenant-scoped operations
- Handlers must be idempotent — safe to retry on failure
- Use Zod schemas from `packages/shared` for any data shared with the frontend
- Write unit tests for handler logic; mock the external API client
