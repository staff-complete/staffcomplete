# Skill: new-lifecycle-event

Add a new lifecycle event type with all required touch points across the codebase.

## Context

Current lifecycle events: `onboarding`, `role_change`, `offboarding`. Adding a new event type touches multiple layers.

## Steps

1. **Get the event name** from the user — use snake_case (e.g. `contract_change`)
2. **Add the event type** to `packages/shared/src/types/lifecycle.ts`:

```typescript
export const LifecycleEventType = z.enum([
  'onboarding',
  'role_change',
  'offboarding',
  '<new_event>',  // add here
])
```

3. **Add the Zod schema** for the event payload to `packages/shared/src/schemas/events.ts`
4. **Add the API route** in `apps/api/src/routes/events.ts` to accept and enqueue the event
5. **Add the workflow stub** — run the `new-workflow` skill for the new event
6. **Add integration handler stubs** — update each existing integration in `apps/api/src/integrations/*/handlers.ts` to handle the new event (even if the handler is a no-op initially)
7. **Update CLAUDE.md** — add the new event to the Core Domain Model section
8. **Suggest an ADR** if this event type represents a significant domain expansion

## Rules

- Zod schema is defined in `packages/shared` — shared between frontend and backend
- Every integration must handle every event — add a no-op handler rather than leaving it missing
- All event handlers receive `tenantId`
