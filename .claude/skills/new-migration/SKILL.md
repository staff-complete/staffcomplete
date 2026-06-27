# Skill: new-migration

Generate a new Drizzle database migration with multi-tenancy constraints enforced.

## Steps

1. **Confirm schema changes are saved** — the Drizzle schema files in `apps/api/src/db/schema/` must reflect the intended changes before generating
2. **Check for tenant_id** — if adding a new table, verify it has a `tenantId` column:

```typescript
tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
```

3. **Check for RLS policy** — if adding a new table with tenant-scoped data, a corresponding RLS policy must be defined. Remind the developer to add it to `apps/api/src/db/rls.ts`
4. **Generate the migration** — run:

```bash
pnpm --filter api drizzle-kit generate
```

5. **Review the generated SQL** — open the migration file in `apps/api/drizzle/` and verify:
   - New tables have `tenant_id`
   - No accidental column drops
   - Indexes are appropriate
   - Foreign keys are correct

6. **Name check** — drizzle-kit auto-names migrations; rename if the auto-name is unclear

## Multi-tenancy checklist for new tables

- [ ] `tenant_id` column present and NOT NULL
- [ ] Foreign key to `tenants.id`
- [ ] RLS policy added in `apps/api/src/db/rls.ts`
- [ ] Index on `tenant_id` for query performance

## Rules

- Never modify an existing migration file — generate a new one
- Migrations run automatically as a Kamal pre-deploy hook — they must be backward-compatible with the currently running version
- Breaking migrations (column drops, renames) require a multi-step deploy strategy
