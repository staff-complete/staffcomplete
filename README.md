# Staff Lifecycle Automation Platform

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/ca00fbb9714f490483fdf1363f8fd8d1)](https://app.codacy.com/gh/staff-complete/staffcomplete/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/ca00fbb9714f490483fdf1363f8fd8d1)](https://app.codacy.com/gh/staff-complete/staffcomplete/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

A SaaS platform for automating the full employee lifecycle across company systems — from onboarding to offboarding and everything in between.

> Every employee state change should automatically reflect across all company systems — safely, consistently, and with a full audit trail.

---

## What this project does

- Employee onboarding
- Role and permission changes
- Offboarding and access removal
- Cross-system provisioning (Google Workspace, Slack, GitHub, and other integrated tools)

## Key Features

### Onboarding Automation

- Create accounts in company tools
- Assign roles and permissions
- Provision access automatically

### Role Management

- Update permissions across systems
- Handle team or department changes
- Maintain sync across integrations

### Offboarding Automation

- Revoke all system access
- Disable accounts
- Ensure secure cleanup of company data access

---

## System Architecture

| Layer      | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Frontend   | Vue 3 + Tailwind + Pinia + TanStack Query                    |
| Backend    | Hono + tRPC + Zod                                            |
| Database   | PostgreSQL + Drizzle, tenant-isolated via Row-Level Security |
| Job queue  | pg-boss                                                      |
| Auth       | Better Auth                                                  |
| Deployment | Docker + Kamal on Hetzner                                    |

Full rationale for each choice — including alternatives considered — is recorded in [docs/decisions/](docs/decisions/README.md) (ADRs).

**Data flow:** a lifecycle event (onboarding / role change / offboarding) is raised → queued by the workflow engine (pg-boss) → dispatched to per-system integration handlers (Google Workspace, Slack, GitHub, …) → every step is recorded for audit.

## Design Principles

- Event-driven, integration-first architecture
- Secure by default: least-privilege access, automatic revocation on offboarding, no hardcoded credentials
- Full audit trail of every lifecycle action
- Idempotent workflows — safe to retry
- Multi-tenant, isolated at the database level (PostgreSQL RLS)

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) — for the devcontainer
- [VS Code](https://code.visualstudio.com/) + [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

All other tooling (Node.js, pnpm, etc.) is provided inside the devcontainer.

### Local Development

1. Clone the repository
2. Open in VS Code — it will prompt to reopen in the devcontainer
3. The devcontainer runs `pnpm install` automatically on creation
4. Start the API: `pnpm --filter api dev`
5. Start the frontend: `pnpm --filter web dev`

---

## Contributing

Contributions go through feature-branch PRs against `main`, following [Conventional Commits](https://www.conventionalcommits.org/). For exact branch naming, commit scopes, commit-signing setup, and CI commands, see [CLAUDE.md](CLAUDE.md) — the single source of truth for repo workflow, kept in sync with the skills in `.claude/skills/`.

## License

[Business Source License 1.1](LICENSE.md) — © Andrew Molyuk
