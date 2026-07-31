---
name: new-integration
description: Add an integration — the client for one external SaaS tool (Slack, Google Workspace, GitHub) that an automated action calls out to. Covers the module layout, credential wiring across all three places a secret must be declared, and how the integration gets reached at runtime. Only invoke when explicitly asked to add an integration, since it creates files and adds secrets.
disable-model-invocation: true
---

# Skill: new-integration

Add an **Integration** — the client for one external SaaS tool.

## Read this first: there is no prior art

`apps/api/src/integrations/` **does not exist yet.** ADR-0018 names it as the intended home
for real handlers, but nothing has been built there, so the first integration establishes the
pattern rather than following one.

The nearest working example is Resend, the one external service this app already calls:
`sendAuthEmail` in `apps/api/src/auth.ts`. It is worth reading before starting — and worth
deciding whether your integration should pull Resend into the new module alongside it, or
leave it where it is. Either is defensible; don't do it by accident.

## How an integration is reached

An integration is **called by an automated action**, never triggered directly by a lifecycle
event. The full chain:

```
automated step on a checklist template   (action = 'slack.invite', config = { channel })
  → run created, step becomes pending
  → dispatchAutomatedSteps enqueues 'automated-step-execute'   (lib/run-steps.ts)
  → executeAutomatedStep branches on the action key            (jobs/execute-automated-step.ts)
  → your integration client                                    (integrations/<module>/client.ts)
```

**An integration with no automated action wired to it is unreachable code.** Adding the
action is part of the job, not a follow-up — use the `new-automated-action` skill.

## Steps

1. **Get the tool name** and derive a kebab-case module name (`google-workspace`, `slack`).

2. **Create the module** at `apps/api/src/integrations/<module-name>/`:

```
apps/api/src/integrations/<module-name>/
  index.ts            # public surface — what the action imports
  client.ts           # SDK/HTTP wrapper, one function per operation
  types.ts            # request/response types not shared with the frontend
  <module>.test.ts
```

Keep the surface to the operations an action actually needs. A wrapper around the whole
vendor SDK is speculative — add operations when an action calls for one.

3. **Construct the client lazily**, inside the call, not at module load:

```typescript
export async function inviteToChannel(channel: string, email: string): Promise<void> {
  const client = new SlackClient(process.env.SLACK_BOT_TOKEN)
  // …
}
```

A client built at import time turns a missing env var into a boot crash for the whole API
rather than one failing step. `sendAuthEmail` constructs its `Resend` per call for this
reason.

4. **Declare the credential in all three places.** Miss the third and it works locally and is
   `undefined` in production:

| File                | What to add                           |
| ------------------- | ------------------------------------- |
| `.env.example`      | the var with a comment on sourcing it |
| `.kamal/secrets`    | `SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN`    |
| `config/deploy.yml` | the name under `env.secret`           |

5. **Wire an automated action to it** — `new-automated-action`. Without this, step 2's code
   is unreachable.

6. **Test** the client with the vendor SDK mocked, and the action branch that calls it. No
   test may make a real network call.

7. **Suggest an ADR** if the integration forces a non-obvious choice — an auth model (OAuth
   app vs. bot token), a sync strategy, or anything that would surprise a future reader.

## Failure handling

Integrations are called from a pg-boss job, so the executor's rule applies unchanged:

- **Transient** (outage, rate limit, expired token) — **throw**. The job retries per the
  `retryLimit: 5` in `dispatchAutomatedSteps`.
- **Permanent** (channel doesn't exist, malformed config) — **log and return**. Retrying
  cannot fix it and just buries the real bug.

Rate limits are the case to think about here: most vendor SDKs surface them as an error that
_is_ worth retrying, and `retryBackoff: true` is already set.

## Rules

- **Idempotent.** The queue retries, so a second run must not duplicate the effect. Prefer
  vendor endpoints that are naturally idempotent, or check-then-act against current state.
- **No network calls inside a database transaction.** Read in one short transaction, call
  out, write in another — see `executeAutomatedStep`.
- **`organizationId`, not `tenantId`.** The job payload carries `organizationId`; pass it
  through to anything tenant-scoped. The concept is "tenant", the column is `organizationId`
  (ADR-0014).
- **There is no `Employee` record.** Employees are not rows and have no login — a run carries
  `employeeName`, `employeeEmail`, `employeeRole` and `eventDate` directly. An integration
  takes the fields it needs, not an entity.
- **Never hardcode credentials.** Read `process.env` at call time; `dotenv-cli` loads `.env`
  in dev scripts, Kamal injects secrets in production.
- **Never call an integration from a route.** Routes enqueue; jobs call out. A slow vendor
  API must not sit in a request.
- Share a type with the frontend only via a Zod schema in `packages/shared`.
