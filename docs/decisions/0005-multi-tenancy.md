# ADR-0005: Multi-Tenancy Strategy

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The platform serves multiple customers (tenants) from a shared infrastructure. Tenant data must be strictly isolated. Options considered: row-level security (RLS), schema-per-tenant, database-per-tenant.

## Decision

Use **PostgreSQL Row-Level Security (RLS)** with a `tenant_id` column on every tenant-scoped table.

- RLS policies enforce isolation at the database level — a misconfigured query cannot leak cross-tenant data
- Single database per deployment — simple ops, no connection management complexity
- `tenant_id` is set on the database session at connection time; application code does not need to add `WHERE tenant_id = ?` to every query
- Drizzle supports RLS policy definitions alongside schema

Schema-per-tenant and database-per-tenant were rejected: Drizzle has poor schema-per-tenant support, and database-per-tenant adds significant ops complexity at this stage.

## Consequences

- Every tenant-scoped table must have `tenant_id` from day one — retrofitting is expensive
- RLS policies must be reviewed on every schema change
- Enterprise customers requiring dedicated infrastructure can be migrated to a separate database instance — the schema is identical, only the connection string changes
- Cross-tenant analytics queries (internal only) require a superuser connection that bypasses RLS
