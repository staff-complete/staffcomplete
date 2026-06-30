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

| Layer              | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo                                   |
| Frontend           | Vue 3 + Vite + Tailwind + Pinia + TanStack Query + Vue Router |
| UI components      | Shadcn/vue                                                    |
| Backend            | Hono + zod-validator + zod-openapi                            |
| API layer          | tRPC                                                          |
| Validation         | Zod                                                           |
| Database           | PostgreSQL + Drizzle + drizzle-kit                            |
| Job queue          | pg-boss (abstracted behind interface)                         |
| Auth               | Better Auth                                                   |
| Email              | Resend                                                        |
| Date/time          | date-fns                                                      |
| Logging            | Pino + Loki + Grafana                                         |
| Error tracking     | Grafana Faro                                                  |
| Testing            | Vitest (unit tests only, no E2E)                              |
| Linting            | oxlint                                                        |
| Formatting         | oxfmt                                                         |
| Spell checking     | cspell                                                        |
| Type checking      | vue-tsc + tsc                                                 |
| Code quality       | Codacy                                                        |
| Security scanning  | CodeQL                                                        |
| Environment        | dotenv                                                        |
| Containerization   | Docker (multi-stage build)                                    |
| Container registry | GHCR                                                          |
| VPS                | Hetzner                                                       |
| Reverse proxy      | Traefik                                                       |
| Deployment         | Kamal                                                         |
| CI/CD              | GitHub Actions                                                |
| Commit validation  | commitlint + husky                                            |
| Releases           | Semantic Release                                              |

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

## Skills

Project-specific skills are in `.claude/skills/`. Use them for common tasks:

| Skill                 | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `start-issue`         | Pick up a GitHub issue: create branch, assign yourself, mark in progress   |
| `new-adr`             | Create a new ADR with correct numbering and update the index               |
| `new-feature`         | Set up a feature branch with correct naming and reminders                  |
| `ci-check`            | Run spell check, lint, format, typecheck, and tests locally before pushing |
| `new-integration`     | Scaffold a new external integration module                                 |
| `new-workflow`        | Scaffold a new lifecycle workflow                                          |
| `new-lifecycle-event` | Add a new lifecycle event type across all touch points                     |
| `new-migration`       | Generate a Drizzle migration with multi-tenancy checks                     |
| `release-check`       | Verify the branch is ready to merge and open a PR                          |
| `security-check`      | Review changed code for credentials, tenant isolation, and auth gaps       |

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
- **Rebase only** — no merge commits; rebase feature branches onto `dev`
- **Linear history** — enforced on both `main` and `dev` via branch protection
- **PR required** — no direct pushes to `main` or `dev`

### Branch model

```
feature/* ──► dev ──► main
               │         │
               ▼         ▼
      dev.staffcomplete  staffcomplete.io
           .io           (+ GitHub Release)
```

- **Feature branches** target `dev`. All day-to-day development goes here.
- **`dev`** is the integration branch. Every merge auto-deploys to `dev.staffcomplete.io`.
- **`main`** is production-only. Only updated by merging `dev` → `main`, which triggers Semantic Release and a production deploy to `staffcomplete.io`.
- Never merge a feature branch directly into `main`.

### Merging a PR (feature → dev)

The `gh` CLI token in this environment lacks merge permissions. Merge PRs locally:

```sh
git checkout dev
git pull origin dev
git merge <branch>   # fast-forward only; no merge commits
git push origin dev
```

**Critical rules — the push will be rejected if either is violated:**

1. **Never commit directly to `dev`.** All work must be on a `feature/*` or `fix/*` branch.
2. **A PR must exist before pushing.** The GitHub ruleset allows fast-forward pushes to `dev`
   only when the commits being pushed belong to an open PR targeting `dev`. Create the PR with
   `gh pr create --base dev` before running `git push origin dev`.
3. **Never disable rulesets** to work around a rejected push — a rejected push means one of the
   above rules was broken. Fix the process, not the protection.

### Releasing to production (dev → main)

When `dev` is stable and ready to ship:

```sh
git checkout main
git pull origin main
git merge dev        # fast-forward only; no merge commits
git push origin main
```

This triggers Semantic Release (GitHub release + changelog) and the production Kamal deploy.

---

## Testing

- **Vitest** for unit and integration tests
- **No E2E tests** — unit tests only
- Tests live alongside source files or in a `__tests__` directory within each app/package

---

## Code Quality

- **oxlint** — linting; run `pnpm lint` to check
- **oxfmt** — formatting; run `pnpm format:check` to check
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

> Note: lifecycle event enum values use `snake_case` (e.g. `role_change`) in code, but commit scopes use `kebab-case` (e.g. `role-change`) per Conventional Commits convention.

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

---

## Issue Tracking

All user stories, bugs, and spikes are tracked as **GitHub Issues**. No external tool.

### Issue types

| Type         | Template      | Use for                                                |
| ------------ | ------------- | ------------------------------------------------------ |
| `user-story` | User Story    | New capabilities from the HR user's perspective        |
| `bug`        | Bug Report    | Something broken in production or staging              |
| `spike`      | Spike         | Time-boxed research with a defined question and output |
| `chore`      | (plain issue) | Maintenance, refactoring, tooling — no template needed |

### Labels

**Type** — one of: `user-story` · `bug` · `spike` · `chore` · `docs`

**Priority** — one of: `P0` · `P1` · `P2` · `P3`

**Area** — one of: `area: onboarding` · `area: offboarding` · `area: role-change` · `area: access` · `area: integrations` · `area: workflows` · `area: auth` · `area: api` · `area: db` · `area: config` · `area: web`

**Status** — one of: `needs-triage` → `status: ready` → `status: in-progress` → `status: blocked` / `status: wont-fix` / `released`

**Severity** (bugs only) — one of: `severity: critical` · `severity: high` · `severity: medium` · `severity: low`

### Workflow

1. File an issue using the appropriate template
2. Triage: add priority, area, and severity labels; remove `needs-triage`; add `status: ready`
3. Pick up: assign to yourself, add `status: in-progress`, create branch with `gh issue develop <n>`
4. Deliver: open a PR referencing the issue (`Closes #n`); merge via the documented PR process
5. Close: issue closes automatically when the PR merges; add `released` when shipped to production

### Branch naming from issues

```sh
gh issue develop <issue-number> --checkout
# creates and checks out: <number>-short-issue-title
```
