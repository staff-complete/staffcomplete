# ADR-0003: Backend Stack

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The API layer must serve the Vue frontend, handle lifecycle event processing, and integrate with external SaaS tools. It needs to be lightweight, TypeScript-first, and deployable in Docker.

## Decision

- **Hono** — lightweight, fast, TypeScript-first HTTP framework; runs on any JS runtime; not tied to a platform
- **tRPC** — end-to-end type-safe API layer between Hono and the Vue frontend; eliminates schema duplication in a monorepo
- **Zod** — runtime validation and schema definition; shared via `packages/shared` between frontend and backend
- **@hono/zod-validator** — request validation middleware using Zod schemas at API boundaries
- **@hono/zod-openapi** — generates OpenAPI documentation from Zod schemas; useful for integration partners

## Consequences

- tRPC is the primary API layer for the frontend; REST endpoints via zod-openapi are for external integrations
- All incoming data is validated with Zod at the boundary — no unvalidated data enters the application
- Hono's lightweight nature means auth, rate limiting, and other concerns are added via middleware
