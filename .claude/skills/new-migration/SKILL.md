# Skill: new-migration

Generate a new Drizzle database migration with multi-tenancy constraints enforced.

## Steps

1. **Confirm schema changes are saved** — the Drizzle schema lives in the single file `apps/api/src/db/schema.ts` (not a `schema/` directory) and must reflect the intended changes before generating
2. **Check for tenant scoping** — if adding a new tenant-scoped table, verify it has an `organizationId` column (see ADR-0014 — the plugin's `organization.id` is the tenant key; the concept is still called "tenant" in ADR-0005/0012 but the FK target is `organization`, not a hand-rolled `tenant` table):

```typescript
organizationId: text('organizationId')
  .notNull()
  .references(() => organization.id, { onDelete: 'cascade' }),
```

3. **Check for RLS policy** — if adding a new table with tenant-scoped data, a corresponding RLS policy must be defined. There's no separate `rls.ts` file — policies are defined inline on the table itself via `pgPolicy(...)` + `.enableRLS()` in `schema.ts` (see the `invitation` table for the pattern). Scope the policy to `tenantRole` (also defined in `schema.ts`) and key it off `current_setting('app.organization_id', true)`
4. **Generate the migration** — run:

```bash
pnpm --filter api db:generate
```

**If the change drops, renames, or restructures a table** (not just adding columns), `drizzle-kit generate` will prompt interactively ("Is X table created or renamed from Y?") to resolve the ambiguity — and that prompt requires a real TTY. It will hang/error in a non-interactive shell (CI, a piped command, this agent's own Bash tool). Run it from an actual terminal in that case, and double check the resolution is what you intended (a genuine drop-and-recreate vs. an accidental rename, or vice versa) — it defaults to treating same-shaped tables as create-new-plus-drop-old unless you tell it otherwise.

5. **Review the generated SQL** — open the migration file in `apps/api/src/db/migrations/` and verify:
   - New tenant-scoped tables have `organizationId`
   - No accidental column drops
   - Indexes are appropriate
   - Foreign keys are correct
   - **Statement order is actually valid, not just diff-correct** — drizzle-kit's raw output isn't guaranteed to be safe to run as-is. Two real failures seen in this repo: a `DROP TABLE ... CASCADE` followed by a separate, now-redundant `DROP CONSTRAINT` on something the cascade already removed (fails: "constraint does not exist"); and a column drop that ran before an `ALTER POLICY` had repointed the RLS policy away from that column (fails: "cannot drop column ... other objects depend on it"). Actually run the migration against a real local Postgres before considering it done — a clean `drizzle-kit generate` diff is not proof it executes cleanly.
6. **Name check** — drizzle-kit auto-names migrations (e.g. `0004_colorful_the_liberteens`); rename the `.sql` file (not the `meta/NNNN_snapshot.json`, which stays index-based) to something descriptive once the migration's purpose is clear, and update its `tag` in `meta/_journal.json` to match.

## Multi-tenancy checklist for new tables

- [ ] `organizationId` column present and NOT NULL
- [ ] Foreign key to `organization.id`
- [ ] RLS policy added inline in `schema.ts` (`pgPolicy(...)` + `.enableRLS()`), scoped to `tenantRole`
- [ ] Index on `organizationId` for query performance

## Rules

- Never modify a migration file that's already been merged to `main` (and possibly deployed) — generate a new one instead. A migration still only living on an open branch/PR (never merged) is fair game to fix in place if it's wrong — that's normal iteration, not history-rewriting.
- Migrations run automatically as a Kamal pre-deploy hook (ADR-0004/0008) — they must be backward-compatible with the currently running version
- Breaking migrations (column drops, renames) require a multi-step deploy strategy
