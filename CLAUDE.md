# CLAUDE.md

This file defines guidance for AI agents working in this repository.

## Project Overview

This project is a SaaS platform for **employee lifecycle management**, including:

- onboarding automation
- offboarding automation
- access provisioning and deprovisioning
- role and permission changes across company systems
- lifecycle event orchestration across HR + IT systems

The system ensures that employee state changes are consistently reflected across all integrated tools (e.g. Google Workspace, Slack, GitHub, internal systems).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Vue 3 + Vite + Tailwind + Pinia + TanStack Query + Vue Router |
| UI components | Shadcn/vue |
| Backend | Hono + zod-validator + zod-openapi |
| API layer | tRPC |
| Validation | Zod |
| Database | PostgreSQL + Drizzle + drizzle-kit |
| Job queue | pg-boss (abstracted behind interface) |
| Auth | Better Auth |
| Email | Resend |
| Date/time | date-fns |
| Logging | Pino + Loki + Grafana |
| Error tracking | Grafana Faro |
| Testing | Vitest (unit tests only, no E2E) |
| Linting | oxlint |
| Formatting | oxfmt |
| Spell checking | cspell |
| Type checking | vue-tsc + tsc |
| Code quality | Codacy |
| Security scanning | CodeQL |
| Environment | dotenv |
| Containerization | Docker (multi-stage build) |
| Container registry | GHCR |
| VPS | Hetzner |
| Reverse proxy | Traefik |
| Deployment | Kamal |
| CI/CD | GitHub Actions |
| Commit validation | commitlint + husky |
| Releases | Semantic Release |

---

## Monorepo Structure

```
apps/
  web/          # Vue 3 frontend (SPA)
  api/          # Hono backend
packages/
  shared/       # Zod schemas and shared types — source of truth for both apps
docs/
  decisions/    # Architecture Decision Records
```

---

## Core Domain Model

### Employee Lifecycle Events
- `onboarding`
- `role_change`
- `offboarding`

### System Concepts
- Employee
- Access Control
- Integrations (external SaaS tools)
- Workflows
- Event-driven automation

---

## Multi-Tenancy

The platform is multi-tenant using PostgreSQL Row-Level Security (RLS).

- **Every tenant-scoped table must have a `tenant_id` column** — this is enforced from day one and cannot be retrofitted cheaply
- RLS policies enforce isolation at the database level — do not rely solely on application-level filtering
- See [ADR-0005](docs/decisions/0005-multi-tenancy.md) for full rationale

---

## Architecture Decision Records (ADRs)

Architectural decisions are documented in `docs/decisions/`. Before proposing changes to the architecture, integrations, or core domain model, read the relevant ADRs to understand prior context and constraints.

- Index: [docs/decisions/README.md](docs/decisions/README.md)
- Template: [docs/decisions/0000-adr-template.md](docs/decisions/0000-adr-template.md)
- ADRs are immutable — never edit a past decision; create a new one that supersedes it
- When a decision you make would be worth recording, suggest creating an ADR

---

## Git Strategy

- **Signed commits required** — all commits must be GPG signed
- **Rebase only** — no merge commits; rebase feature branches onto `main`
- **Linear history** — enforced on `main` via branch protection
- **PR required** — no direct pushes to `main`

---

## Testing

- **Vitest** for unit and integration tests
- **No E2E tests** — unit tests only
- Tests live alongside source files or in a `__tests__` directory within each app/package

---

## Code Quality

- **oxlint** — linting; run `pnpm lint` to check
- **oxfmt** — formatting; run `pnpm format` to check
- **vue-tsc** — type checking for `apps/web`
- **tsc** — type checking for `apps/api` and `packages/shared`
- All checks must pass before merging; Codacy and CodeQL run automatically on PRs

---

## Commit Message Convention

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that is neither a fix nor a feature
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — build process, tooling, dependencies
- `ci` — CI/CD configuration
- `perf` — performance improvement
- `style` — formatting, whitespace (no logic change)
- `revert` — reverts a previous commit

**Scopes** (optional, use the affected domain area):
- `onboarding`, `offboarding`, `role-change`
- `access`, `integrations`, `workflows`
- `auth`, `api`, `db`, `config`

**Examples:**
```
feat(onboarding): add Slack workspace provisioning step
fix(access): correct deprovisioning order for GitHub org removal
chore(deps): bump @types/node to 20.x
```

**Rules:**
- Subject line ≤ 72 characters, lowercase, no trailing period
- Use imperative mood ("add", not "added" or "adds")
- Breaking changes: append `!` after the type/scope and add a `BREAKING CHANGE:` footer
- **One type per commit** — never combine multiple `type: ...` lines into a single commit message. If changes span multiple concerns, create separate commits.
- **No AI co-author trailers** — do not add `Co-authored-by: Claude` or any AI attribution to commit messages.
