# ADR-0008: Deployment and Infrastructure

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The application must deploy automatically on push to `main`, run in Docker, and support two deployment modes: cloud SaaS (our VPS) and on-premise (customer's server, self-updating).

## Decision

- **Docker** — multi-stage builds for the monorepo; single image bundles the Hono API and serves the Vue SPA as static files
- **GHCR** — container registry; integrated with GitHub Actions via `GITHUB_TOKEN`, no extra credentials
- **Hetzner** — VPS provider for the cloud SaaS deployment
- **Traefik** — reverse proxy; handles SSL termination, routing, and health checks; managed by Kamal
- **Kamal** — SSH-based deployment tool; no extra infrastructure, config lives in `config/deploy.yml`; deploys by pulling the new image and doing a zero-downtime container swap

Deploy flow:

1. Push to `main`
2. GitHub Actions builds image, pushes to GHCR
3. GitHub Actions runs `kamal deploy` via SSH
4. Kamal runs drizzle-kit migrations as a pre-deploy hook
5. New container swaps in

On-premise self-updating (deferred — implement when first customer requires it).

## Consequences

- Kamal requires SSH access to the Hetzner server from GitHub Actions — an SSH key must be stored as a GitHub secret
- Multi-stage Docker build must be optimized for the monorepo — only changed apps should rebuild (Turborepo remote cache helps)
- Traefik config is managed by Kamal — avoid manual Traefik configuration outside of `config/deploy.yml`
