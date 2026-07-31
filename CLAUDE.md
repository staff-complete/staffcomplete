# CLAUDE.md

AI agent guidance for this repository: a SaaS platform for **employee lifecycle management** — onboarding, offboarding, role changes, access provisioning/deprovisioning, and event-driven orchestration across HR + IT systems (Google Workspace, Slack, GitHub, and other integrated tools).

---

## Development environment

**All development — including CLI tools like `gh`, `kamal`, `ruby`, not just app code — happens inside the devcontainer (`.devcontainer/`), never on the bare host.** The Dockerfile already installs everything needed: `gh`, `ruby-full` + `kamal`, Node 24, `pnpm`, `turbo`, git/SSH tooling.

If a tool seems missing, that means you're not in the devcontainer — it is not a reason to `brew`/`apt-get install` it onto the host. If something is genuinely missing from the devcontainer, add it to `.devcontainer/Dockerfile` so it's versioned for everyone.

---

## Architecture

- **Monorepo**: pnpm workspaces + Turborepo. `apps/web` (Vue 3 SPA), `apps/api` (Hono), `packages/shared` (Zod schemas — source of truth for types used by both apps), `docs/decisions` (ADRs).
- **Non-default tooling** worth knowing before reaching for the usual default: **oxlint**/**oxfmt** (not ESLint/Prettier), **Vitest** for unit tests only (no E2E — don't add Playwright/Cypress), **tRPC** on top of Hono, **Better Auth** (not Auth.js/Passport), **Kamal** deploys to Hetzner via GHCR + Traefik, **Drizzle**/drizzle-kit for Postgres, **pg-boss** behind a `Queue` interface.
- Full rationale for stack and architecture decisions lives in `docs/decisions/` (ADRs, indexed at `docs/decisions/README.md`). Read the relevant ADR before proposing changes to architecture, integrations, or the core domain model. **ADRs are immutable** — never edit one; create a new one that supersedes it (or use the `new-adr` skill).

### Core Domain Model

**Employee Lifecycle Events**: `onboarding` · `offboarding` (`role_change` is named in the model but not yet built)

**System Concepts**: Employee, Access Control, Integrations (external SaaS tools), Checklist Templates, Runs, Event-driven automation

"Workflow" is retired as a domain term — only the `workflow_template*` SQL table names still carry it. See CONTEXT.md.

Full vocabulary lives in [CONTEXT.md](CONTEXT.md) — the glossary of canonical domain terms and the synonyms to avoid. Read it before naming anything; use the `domain-modeling` skill to change it.

---

## Multi-tenancy — read before touching the schema

- PostgreSQL **Row-Level Security (RLS)** enforces tenant isolation at the database level — never rely on application-level filtering alone.
- Every tenant-scoped table needs an **`organizationId`** column (`NOT NULL`, FK to `organization.id`) and an inline RLS policy defined in `apps/api/src/db/schema.ts` (`pgPolicy(...)` + `.enableRLS()`), keyed off `current_setting('app.organization_id', true)`. There's no separate `rls.ts` file.
- The column is `organizationId`, **not** `tenant_id` — ADR-0005 and ADR-0014 still use "tenant" as the conceptual term, but the actual FK target is Better Auth's `organization` table, not a hand-rolled `tenant` table.
- Use the `new-migration` skill for schema changes — it enforces this checklist and knows about drizzle-kit's interactive-prompt/statement-ordering pitfalls.

---

## Git workflow

Trunk-based, no `dev` branch or staging environment (ADR-0013). `main` is the only long-lived branch — every merge triggers Semantic Release (changelog + GitHub Release) and a production Kamal deploy.

- **Signed commits required** (SSH signing, not GPG). **Rebase only** — no merge commits; linear history is enforced on `main`.
- Create branches with the `start-issue` or `new-feature` skill, which apply the right `feat/`·`fix/`·`chore/`·`docs/` prefix.
- **Never commit directly to `main`.**
- **A PR must exist before pushing to `main`** — the branch ruleset only fast-forwards commits that belong to an open PR targeting `main`. Create the PR first: `gh pr create --base main`.
- **Never disable the ruleset** to force through a rejected push — a rejection means one of the rules above was broken; fix the process, not the protection.

**Merging a PR** (the `gh` token here lacks merge permissions, so merge locally):

```sh
git checkout main && git pull origin main
git merge <branch>   # fast-forward only, no merge commit
git push origin main
```

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), **one type per commit** — never combine multiple `type: ...` concerns in one commit.

Types: `feat` `fix` `refactor` `test` `docs` `chore` `ci` `perf` `style` `revert`
Scopes: `onboarding` `offboarding` `role-change` `access` `integrations` `checklists` `auth` `api` `db` `config` (kebab-case in commits — the `role_change` lifecycle-event enum value itself is snake_case in code)

- Subject ≤ 72 chars, lowercase, imperative mood, no trailing period
- Breaking change: `!` after type/scope, plus a `BREAKING CHANGE:` footer
- No `Co-authored-by: Claude` or other AI-attribution trailers

---

## Issues

Tracked as **GitHub Issues** only — no external tool. New issues auto-add to the [project board](https://github.com/orgs/staff-complete/projects/1); closing/updating an issue moves it there automatically, but you must update the issue **label** and board **status** together — one doesn't push to the other.

| Type         | Template   | Use for                                            |
| ------------ | ---------- | -------------------------------------------------- |
| `user-story` | User Story | New capability from the HR user's perspective      |
| `bug`        | Bug Report | Something broken in production or staging          |
| `spike`      | Spike      | Time-boxed research with a defined question/output |
| `chore`      | (none)     | Maintenance, refactoring, tooling                  |

Labels: priority (`P0`–`P3`) · area (`area: <domain>`) · status (`needs-triage` → `status: ready` → `status: in-progress` → `status: blocked`/`wont-fix`/`released`) · severity, bugs only (`severity: critical|high|medium|low`).

An issue is `status: ready` once it has a priority, an area label, and acceptance criteria clear enough to start without more questions (severity too, for bugs). Board status: Backlog = `needs-triage`, Ready = `status: ready`, In progress = `status: in-progress`, Done = closed.

Pick up an issue with `gh issue develop <n> --checkout`, or the `start-issue` skill. PRs reference the issue (`Closes #n`).

---

## Testing & code quality

- **Vitest** — unit/integration tests only, no E2E. Tests live alongside source or in `__tests__`.
- `pnpm test` / `pnpm test:coverage` · `pnpm lint` (oxlint) · `pnpm format:check` (oxfmt) · `pnpm typecheck` (vue-tsc for `apps/web`, tsc for `apps/api`/`packages/shared`) · `pnpm cspell`
- All must pass before merging — run the `ci-check` skill locally to catch failures before pushing; Codacy and CodeQL also run automatically on PRs.

---

## Skills

`.claude/skills/` covers most recurring workflows — prefer these over doing the equivalent steps by hand:

`start-issue` · `new-feature` · `new-adr` · `new-integration` · `new-automated-action` · `new-lifecycle-event` · `new-migration` · `domain-modeling` · `ci-check` · `release-check` · `security-check`
