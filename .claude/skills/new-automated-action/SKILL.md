---
name: new-automated-action
description: Add a new automated action to the registry — the thing an automated checklist step actually performs when a run reaches it. Covers the shared registry entry, the executor branch, i18n labels and the editor's config fields. Only invoke when explicitly asked to add an automated action, since it edits several files across both apps.
disable-model-invocation: true
---

# Skill: new-automated-action

Add a new **Automated Action** — the specific thing an automated step performs (ADR-0018).

Today the registry holds exactly one, `email.send`. Adding the second is the case this skill
is written for, so expect to be the first to generalise anything hand-coded for one.

## Where the pieces live

An action is spread across five places. Miss one and it fails in a different, confusing way:

| Layer         | File                                                | Miss it and…                         |
| ------------- | --------------------------------------------------- | ------------------------------------ |
| Registry      | `packages/shared/src/automation.ts`                 | the API rejects the step at create   |
| Type export   | `packages/shared/src/index.ts`                      | the executor can't type its config   |
| Executor      | `apps/api/src/jobs/execute-automated-step.ts`       | the step completes as a silent no-op |
| Label         | `apps/web/src/i18n/locales/{en,ru,he}.ts`           | the UI renders the raw key           |
| Editor fields | `apps/web/src/composables/useActionConfigFields.ts` | admins can't configure it            |

## Steps

1. **Pick the key** — `domain.verb`, lowercase, dot-separated (`email.send`, `slack.invite`).
   It is stored in the database on every step that uses it, so treat it as permanent.

2. **Add the config schema and registry entry** in `packages/shared/src/automation.ts`. Use
   `z.strictObject` — an unknown key is a caller bug, not something to silently accept:

```typescript
export const slackInviteConfigSchema = z.strictObject({
  channel: z.string().min(1, 'Channel is required'),
})
export type SlackInviteConfig = z.infer<typeof slackInviteConfigSchema>

export type AutomatedActionKey = 'email.send' | 'slack.invite' // add to the union

const automatedActionEntries: ReadonlyArray<[AutomatedActionKey, AutomatedActionDefinition]> = [
  ['email.send', { label: 'Send email', configSchema: emailSendConfigSchema }],
  ['slack.invite', { label: 'Invite to Slack channel', configSchema: slackInviteConfigSchema }],
]
```

`label` is the English fallback for contexts that can't reach vue-i18n (server-side step
title, activity feed) — **not** the UI string. The UI translates the key instead (step 5).

3. **Export the config type** from `packages/shared/src/index.ts`, alongside `EmailSendConfig`.

4. **Add the executor branch** in `apps/api/src/jobs/execute-automated-step.ts`, at the
   `// Only one action is registered today — a second one branches here.` comment:

```typescript
if (prepared.action === 'email.send') {
  await sendEmailAction(prepared.config as EmailSendConfig, prepared.run)
} else if (prepared.action === 'slack.invite') {
  await slackInviteAction(prepared.config as SlackInviteConfig, prepared.run)
}
```

Read the failure-handling rules below before writing the action body — that is the part that
is easy to get wrong and hard to notice.

5. **Add the label** to all three locales under `checklists.automatedActions.<key>` (ADR-0016
   — `he.ts` is RTL). Add any config field labels under `checklists.editor.*`.

6. **Add the editor's config fields** to `apps/web/src/composables/useActionConfigFields.ts`,
   widening `ActionConfigField['key']` for the new fields. That list is web-layer-only and
   deliberately not derived from the Zod schema — if a third action makes hand-maintaining it
   worse than generating it, that is the moment to make it schema-driven, not before.

7. **Test** the executor branch: config parsed, the external call made, the step completed,
   and a transient failure rethrown. Mock the external client.

## Failure handling — throw vs. log

The executor separates two kinds of failure, and the difference decides whether pg-boss
retries:

- **Transient** (outage, bad credentials, timeout) — **throw**. The job rejects and retries
  per the `retryLimit` in `dispatchAutomatedSteps`.
- **Data integrity** (the row and the registry have drifted, config no longer parses) — **log
  and return**. Retrying cannot fix it, so a retry loop just buries the real bug.

## Rules

- **Idempotent.** The queue may retry. The executor already guards on
  `step.status !== 'pending'`; anything your action does on top of that must tolerate a
  second run.
- **No network calls inside a transaction.** Read in one short transaction, make the call
  outside it, write completion in another. `withTenant` scopes each one to the org.
- **Registry lookups use `Map.get()`, never `registry[key]`** — a runtime-string index is
  flagged as an object-injection sink by static analysis, even when the key type is a closed
  union (ADR-0018; it has been hit twice).
- **Placeholder tokens are `[bracket]`, never `{{mustache}}`** — `{...}` collides with
  vue-i18n's own interpolation wherever the value is shown as hint text (ADR-0018).
  Substitute with `substituteAutomationTokens`; the run fields available are
  `[employeeName]`, `[employeeEmail]`, `[employeeRole]`, `[eventDate]`.
- **Escape at the point of interpolation**, not at substitution — see `sendEmailAction`,
  which substitutes raw and calls `escapeHtml` only where the value enters HTML.
- Every step carries `organizationId`; pass it through to anything tenant-scoped.

## Scope note

This skill replaces `new-workflow`, which scaffolded `apps/api/src/workflows/<name>/` — a
runtime workflow-engine architecture that was never built. "Workflow" is retired as a domain
term (see CONTEXT.md); automated actions are how automation is actually extended here.

Reaching an external SaaS tool (Slack, Google Workspace, GitHub) is still expected to sit
behind an integration module — see `new-integration`. Note that pattern is likewise not built
yet: `apps/api/src/integrations/` does not exist, so the first real action needing it will
have to establish it.
