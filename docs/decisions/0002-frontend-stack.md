# ADR-0002: Frontend Stack

- **Status:** accepted
- **Date:** 2026-06-27

## Context

The platform needs an admin UI for HR/IT operators to manage employee lifecycle events, access provisioning, and integrations. It is an internal tool with no SEO requirements.

## Decision

- **Vue 3** — Composition API, strong TypeScript support, author has experience with it
- **Vite** — fast dev server and build tool, native Vue support
- **Vue Router** — standard SPA routing for Vue
- **Pinia** — official Vue state management, simpler than Vuex
- **TanStack Query** — server state management, caching, loading/error handling for API calls
- **Tailwind CSS** — utility-first styling
- **Shadcn/vue** — accessible, unstyled component primitives built on Tailwind
- **date-fns** — stable, tree-shakeable date utilities; preferred over Temporal (still a polyfill) and dayjs (mutable Date issues)

No SSR framework (no Nuxt) — a plain SPA is sufficient for an authenticated internal tool.

## Consequences

- No SSR — not suitable for public-facing or SEO-sensitive pages
- TanStack Query handles all server state; Pinia is for local/UI state only
- Shadcn/vue components are copied into the repo, not installed as a dependency — they are owned and customizable
