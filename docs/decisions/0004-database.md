# ADR-0004: Database

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The platform stores employee records, lifecycle events, job queue state, auth sessions, and tenant data. Data integrity and relational queries are important. The database must support multi-tenancy via Row-Level Security.

## Decision

- **PostgreSQL** — reliable, feature-rich relational database; native support for RLS, JSON columns, and advisory locks
- **Drizzle ORM** — TypeScript-first ORM with full type inference from schema; supports RLS and raw SQL escape hatches
- **drizzle-kit** — migration generation and execution; migrations run as a Kamal deploy hook before container swap

Single PostgreSQL instance per deployment (shared for cloud SaaS, dedicated for on-premise customers).

## Consequences

- Drizzle schema is the source of truth — no separate migration files written by hand
- Migrations run automatically on deploy; breaking migrations must be backward-compatible with the running version
- pg-boss (job queue) also uses this PostgreSQL instance — no separate queue infrastructure needed
