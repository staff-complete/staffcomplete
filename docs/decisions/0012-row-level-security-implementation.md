# ADR-0012: Row-Level Security Implementation Mechanism

- **Status:** accepted
- **Date:** 2026-07-11

## Context

ADR-0005 decided to use PostgreSQL Row-Level Security with a `tenant_id` column on every tenant-scoped table, so that "a misconfigured query cannot leak cross-tenant data." No RLS policies were ever added, though — the `invitation` table (and `user` before it) enforced tenant isolation entirely in application code (`WHERE tenantId = ?` in each handler).

While implementing RLS, we found the app connects to Postgres as `staffcomplete`, which is a **superuser with `rolbypassrls = true`** — both in the local dev container and in the production Kamal accessory (`POSTGRES_USER: staffcomplete` in `config/deploy.yml` creates the same kind of role). In PostgreSQL, superusers and `BYPASSRLS` roles always bypass RLS policies, regardless of `FORCE ROW LEVEL SECURITY`. Enabling RLS and writing policies without addressing this would have no effect — the app would keep bypassing every policy it wrote, while looking like the gap was closed.

We also found that RLS can't be applied uniformly to every table with a `tenant_id`-shaped column. Better Auth's Drizzle adapter queries `user`/`session`/`account`/`verification` directly, and some of those lookups (e.g. "find user by email" during sign-in) happen _before_ the caller's tenant is known — that lookup is how the tenant gets resolved in the first place. A tenant-matching policy on `user` would break sign-in outright, since Better Auth's adapter has no mechanism to set a per-request tenant context.

## Decision

1. **A second, non-superuser Postgres role** (`staffcomplete_tenant`) is used for tenant-scoped application queries. It has no `BYPASSRLS` and does not own the tables, so RLS policies actually apply to it. It's declared in `apps/api/src/db/schema.ts` via Drizzle's `pgRole` so `CREATE ROLE` ships in a normal migration; `LOGIN`/`PASSWORD` and table grants are applied separately by an idempotent script (`apps/api/src/db/setup-tenant-role.ts`) reading the password from `TENANT_POSTGRES_PASSWORD`, since Drizzle's role DDL doesn't manage passwords and those shouldn't live in version-controlled SQL.

2. **Tenant context is set per-transaction**, not per-connection, since connections are pooled and shared across requests. `apps/api/src/db/index.ts` exposes `withTenant(tenantId, fn)`, which opens a transaction on the restricted connection and runs `select set_config('app.tenant_id', $1, true)` (parameterized, not string-interpolated) before calling `fn`. RLS policies check `tenantId = current_setting('app.tenant_id', true)` — the `true` means "return NULL if unset" rather than erroring, so any query that reaches the table without going through `withTenant` sees zero rows instead of failing open.

3. **Scope is limited to tables the app fully owns and queries in a genuinely tenant-scoped way** — currently just `invitation`. `user`/`session`/`account`/`verification` are explicitly **excluded** and continue on the superuser connection, because:
   - Better Auth's adapter can't participate in the `withTenant` transaction pattern.
   - Their access patterns (lookup by email, by session token, by verification token) are single-row lookups keyed by an unguessable or unique value, not tenant-scoped listing/mutation — the same reasoning that already applies to the invite system's two public token-based endpoints (`GET /api/invites/:token`, `POST /api/invites/:token/accept`), which also stay on the superuser connection for the same reason.
   - `tenant` itself isn't tenant-_scoped_ (it's the root entity), so it isn't a policy candidate either.

   This is a real, load-bearing gap, not an oversight: cross-tenant isolation for `user` still depends entirely on `email` being globally unique and on the application code that sets `tenantId` at signup/invite-accept time being correct. If a second tenant-scoped table with the same "public lookups + admin-scoped listing" shape as `invitation` is added later, it should follow the same pattern deliberately, not be assumed covered by this ADR.

4. **Production provisioning is manual for now.** The Kamal pre-deploy hook that would have run migrations automatically was removed in `96fa305` ("until migrations are implemented") and nothing has replaced it — migrations aren't applied automatically on any deploy today. `setup-tenant-role.ts` inherits that same gap: until the migration pipeline exists, both migrations and the role-setup script must be run by hand against production. This ADR doesn't attempt to fix that; it's a pre-existing, separate problem.

## Consequences

- Cross-tenant data leaks in `invitation` now require a Postgres role/policy misconfiguration in addition to an application bug — the property ADR-0005 wanted.
- Every new tenant-scoped table needs an explicit decision about whether it fits the `withTenant` pattern (admin-scoped CRUD) or the "public token lookup" pattern (stays on the superuser connection) — this isn't automatic and won't be caught by types or tests if someone picks wrong.
- Two live Postgres connections/pools now exist in `apps/api` (`db`, `tenantDb`). Anyone adding a new tenant-scoped route needs to know to reach for `withTenant`/`tenantDb`, not `db` — there's no lint rule enforcing this yet.
- `TENANT_POSTGRES_PASSWORD` is a new secret that must be provisioned in every environment (local `.env`, production) and rotated independently of `POSTGRES_PASSWORD`.
- `user`/`session`/`account`/`verification` remain unprotected by RLS. This should be revisited if Better Auth ever supports per-request context injection, or if we outgrow "email is globally unique across all tenants" as the isolation boundary for accounts.
