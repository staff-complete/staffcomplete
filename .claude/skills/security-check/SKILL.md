---
name: security-check
description: Review the current diff for security issues specific to this project — hardcoded credentials, tenant isolation gaps, missing input validation, missing auth middleware, leaked secrets, vulnerable dependencies. Use before merging a PR, or when asked to check for security problems.
allowed-tools: Bash(git diff *), Bash(pnpm audit *)
---

# Skill: security-check

Review changed code for security issues specific to this project before merging.

## Steps

Run each check and report findings:

### 1. Hardcoded credentials

Search for secrets, tokens, or API keys in source files:

```bash
git diff origin/main..HEAD -- '*.ts' '*.json' '*.env*'
```

Flag any strings matching patterns: `sk_`, `ghp_`, `xoxb-`, `AIza`, passwords, connection strings with credentials.

### 2. Tenant isolation

For every new or modified database query:

- Confirm `organizationId` is used as a filter
- Confirm RLS policies cover new tables — there's no separate `rls.ts` file; policies are defined inline per-table in `apps/api/src/db/schema.ts` via `pgPolicy(...)` + `.enableRLS()`
- Flag any query that could return cross-tenant data

### 3. Input validation

For every new or modified API route:

- Confirm `@hono/zod-validator` middleware is applied
- Confirm Zod schemas are defined in `packages/shared` (not inline)
- Flag any route that accepts user input without validation

### 4. Auth middleware

For every new or modified route:

- Confirm Better Auth middleware is applied to protected routes
- Flag any route that should require authentication but doesn't

### 5. Environment variables

- Confirm no new secrets are committed to `.env` files tracked by git
- Confirm new secrets are documented in `.env.example` with placeholder values
- Confirm `dotenv` loads variables before they are accessed

### 6. Dependencies

- Check for new dependencies with known vulnerabilities: `pnpm audit`

## Report

For each check: pass or list specific findings with file and line number.
Severity: critical (tenant data leak, exposed credentials) vs. warning (missing validation on low-risk route).
