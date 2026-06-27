# ADR-0001: Monorepo with pnpm Workspaces and Turborepo

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The platform has a frontend (Vue SPA), a backend (Hono API), and shared code (Zod schemas, types). These need to live together to share types end-to-end without duplication or publishing overhead.

## Decision

Use a monorepo with pnpm workspaces for package linking and Turborepo for build orchestration, caching, and parallel task execution.

Structure:

```
apps/
  web/      # Vue 3 frontend
  api/      # Hono backend
packages/
  shared/   # Zod schemas, shared types
```

Turborepo caches build and test outputs per package — CI only rebuilds what changed.

## Consequences

- Shared types flow from `packages/shared` to both apps with no publishing step
- Turborepo remote cache (self-hosted or Vercel) can further speed up CI
- All packages must be TypeScript — no mixing runtimes
