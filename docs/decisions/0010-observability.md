# ADR-0010: Observability

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The platform runs async lifecycle jobs and integrates with external systems. Failures, latency, and errors must be visible without relying on paid hosted services.

## Decision

All observability tooling is self-hosted on Hetzner alongside the application — no vendor dependency, always free.

- **Pino** — structured JSON logging in the Hono backend; low overhead, fast, pairs well with Loki
- **Loki** — log aggregation; ingests Pino JSON logs from Docker containers
- **Grafana** — visualization for logs (Loki) and metrics; single dashboard for ops
- **Grafana Faro** — frontend error tracking and performance monitoring; integrates natively with the existing Grafana stack

Alternatives rejected:
- Betterstack/Axiom — hosted, data leaves infrastructure
- Sentry (self-hosted) — too resource-heavy (4GB+ RAM)
- Glitchtip — less mature

## Consequences

- Loki + Grafana + Faro run as additional Docker services on the Hetzner VPS — account for their resource usage when sizing the server
- Pino must be configured to output JSON in production; pretty-print in development
- Grafana Faro SDK is added to the Vue frontend — adds a small bundle size overhead
