# ADR-0018: Automated Action Registry for Workflow Steps

- **Status:** accepted
- **Date:** 2026-07-24

## Context

A `workflowTemplateStep`/`runStep` has always had a `type` of `automated` or
`manual`, but both types shared exactly one shape: `title` (free text) +
optional `assigneeId`. An automated step's `assigneeId` was never actually
used anywhere — `tasks.ts`'s "my tasks" endpoint filters to
`type: 'manual'` only, and there's no execution engine that would read it —
so setting an assignee on an automated step was possible in the editor but
silently inert. Marking a step "automated" changed UI labeling only; it
carried no reference to _which_ automation would run, or what parameters it
would need (a "create GitHub account" step needs a team/role, a "send
email" step needs a recipient and content — these aren't interchangeable).

## Decision

Add an **action registry** (`packages/shared/src/automation.ts`): each
registered action is a key (e.g. `email.send`) mapped to a label and its own
Zod config schema. `createStepSchema` becomes a **discriminated union on
`type`** instead of one schema with optional fields — a manual step is
`{ title, assigneeId?, dueDateOffsetDays? }`; an automated step is
`{ title, action, config }`, where `config` is validated against that
specific action's schema (`parseAutomatedActionConfig`) rather than a shape
shared across all actions. Neither kind's fields apply to the other, and the
API rejects a mismatch (`assigneeId` on automated, `action`/`config` on
manual) with `400 TYPE_MISMATCH`.

`title` stays a real, independently user-set field on **both** kinds — it is
not derived from the action's label. A template can have several steps
using the same action (e.g. two `email.send` steps addressed to different
recipients) that need distinguishing; the registry label is only a UI
default used to prefill the title field when an action is first picked, and
the English-language fallback for contexts that can't reach vue-i18n
(server-side step title, activity feed). The UI itself translates the
action's label via `t('workflows.automatedActions.<action>')`, same as any
other fixed UI vocabulary — it is not user-authored content like a manual
step's title, so it doesn't belong in the database as English-only text
the way a free-text title does.

**Registry lookups use a `Map`, not a plain object.** `automatedActionRegistry[key]`
where `key` is a runtime string (even one already validated as a real
`AutomatedActionKey`) is exactly the shape static analysis flags as a
generic object injection sink — hit twice in this session, in two different
files, both fixed by switching to `Map.get()`. Any future registry-style
lookup keyed by a value that started as external input should default to a
`Map` for this reason, not because of an actual injection risk here (the
key type is a closed union), but because Codacy can't see that guarantee.

**Config placeholder tokens use `[bracket]` syntax, not `{{mustache}}`.**
`email.send`'s `to`/`body` fields may reference `[employeeName]`,
`[employeeEmail]`, `[employeeRole]`, `[eventDate]` (the `run` fields of the
same name). Double curly braces were considered and rejected because
vue-i18n's own interpolation syntax is `{named}` — showing `{{employeeName}}`
as hint text inside a `t()`-resolved message risks the compiler treating it
as a malformed interpolation token.

## Consequences

- Only one action is registered today (`email.send`), and it does not
  actually send anything — the registry validates and stores `action` +
  `config`, but there is still no execution engine that reads them. The
  `new-integration` skill's intended pattern
  (`apps/api/src/integrations/<module>/`, triggered off the job queue) is
  the eventual home for real handlers; wiring `action` to a real handler is
  future work, deliberately out of scope here.
- Adding a second action means adding a registry entry with its own config
  schema — the mechanism is generic, but the web editor's config UI
  (`WorkflowEditorView.vue`) currently hand-codes `email.send`'s
  `to`/`subject`/`body` fields rather than rendering them from the schema;
  a second action will need either its own hand-coded fields or a
  schema-driven form, whichever turns out to matter once there's a second
  real example.
- A step's `type` is immutable after creation (delete and recreate to
  change it) — `updateStepSchema` never discriminates on `type`, which
  keeps partial updates simple but means converting a step from manual to
  automated mid-edit isn't supported, by design.
