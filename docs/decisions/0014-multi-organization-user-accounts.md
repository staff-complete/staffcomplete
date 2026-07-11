# ADR-0014: Multi-Organization User Accounts via Better Auth's Organization Plugin

- **Status:** accepted
- **Date:** 2026-07-11

## Context

The current schema ties a user to exactly one tenant (`user.tenantId`, a single nullable column). This surfaced as a real product problem while shipping the invite flow: when an admin invites an email that already has an account in a _different_ tenant, there's no legitimate way to add that person — the schema has no concept of a second membership. The only options were either silently failing (confusing for the admin, who sees "invite sent" with no explanation when nothing ever happens) or leaking whether that email exists elsewhere (an enumeration vulnerability, since that admin has no relationship to a stranger's account). Several PRs in this session (email-enumeration fix, owner-notification email, same-tenant-vs-cross-tenant invite split) were built specifically to navigate this tension without fixing its cause.

Real products in this space (Slack, GitHub, Linear) don't have this problem because one account can belong to many organizations — being invited to a new org with an existing email is a normal, unremarkable action, not a sensitive one.

The project already depends on Better Auth (ADR-0007) for session management. Better Auth ships an official `organization` plugin — already present in the installed dependency, no version change needed — providing `organization`/`member`/`invitation` tables, full CRUD APIs (create org, invite/accept/reject, list/update/remove members, switch active org), and a role/permission system, all designed for exactly this multi-org-per-user shape.

## Decision

Adopt Better Auth's `organization` plugin to support multi-organization user accounts, rather than hand-rolling an equivalent `member` join table and invite/session APIs from scratch.

- A user gains a `member` row per organization they belong to (via the plugin's own schema), replacing the single `user.tenantId`/`user.role` columns.
- Session state tracks an **active organization**; the UI gains an org switcher so a user in multiple orgs can move between them.
- `onboard.ts`/`invites.ts`'s hand-built de-duplication/notification logic is replaced by the plugin's own invite flow, which natively supports inviting an existing account to an additional org.
- The project is pre-launch with no real customer data to preserve, so this ships as a clean schema replacement rather than a data migration — existing `tenant`/`invitation`/`user` rows are dropped and recreated under the plugin's schema, not transformed in place.
- ADR-0005's RLS strategy is **not superseded** — every tenant-scoped table keeps its `tenant_id` column and RLS policy. `withTenant()` (ADR-0012) is re-keyed off the plugin's `organization.id` instead of the current hand-rolled `tenant.id`; the plugin doesn't manage RLS, so that integration remains our responsibility.

**Alternative considered:** hand-roll a custom `member` join table without adopting the plugin. Rejected — this is exactly the shape Better Auth's organization plugin already solves, including invite flows and session-level active-org tracking; building it ourselves would duplicate a well-tested feature for no benefit, since the project is already committed to Better Auth for auth generally.

**Alternative considered:** keep the single-tenant-per-user model and just improve the messaging around cross-tenant invite attempts (e.g. the non-committal "if eligible, an invite was sent" copy drafted during this session). Rejected as a permanent fix — it papers over the UX gap without addressing the underlying limitation, and leaves the enumeration-protection code path as permanent, unremovable complexity instead of a problem that stops existing.

## Consequences

- Inviting an existing account to a second org becomes a normal, fully-supported feature — the entire enumeration-vs-UX tension this session spent several PRs navigating goes away, and that code can eventually be deleted rather than maintained.
- No data migration needed — production's current `tenant`/`invitation`/`user` data can simply be wiped and recreated under the new schema, since there's no real customer data yet. This significantly lowers the cost of doing this now versus after launch, when a real migration would become unavoidable.
- RLS policies (`invitation_tenant_isolation` and any future ones) must be re-threaded to key off `organization.id`; this is not something the plugin does for us and needs the same care as the original ADR-0012 work.
- The frontend gains real new surface area: an org switcher, and every view currently assuming one fixed tenant must instead read the active organization from session.
- `onboard.ts`, `invites.ts`, and their test suites need substantial rewrites against the plugin's APIs rather than incremental changes.
- Estimated as a multi-day effort for a solo developer, not a small PR — but cheaper now than after real customer data and integrations come to depend on the single-tenant assumption (the same day-one reasoning ADR-0005 already applied to `tenant_id`).
