# Staff Lifecycle Automation Platform

A SaaS platform for automating the full employee lifecycle across company systems — from onboarding to offboarding and everything in between.

---

## What this project does

This system helps companies automatically manage:

- Employee onboarding
- Role and permission changes
- Offboarding and access removal
- Cross-system provisioning (Google Workspace, Slack, GitHub, etc.)

It ensures that employee lifecycle changes are consistently applied across all connected tools.

---

## Core idea

> Every employee state change should automatically reflect across all company systems — safely, consistently, and auditable.

---

## Tech Stack

| Layer         | Choice                                                        |
| ------------- | ------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                   |
| Frontend      | Vue 3 + Vite + Tailwind + Pinia + TanStack Query + Vue Router |
| UI components | Shadcn/vue                                                    |
| Backend       | Hono + tRPC + Zod                                             |
| Database      | PostgreSQL + Drizzle                                          |
| Job queue     | pg-boss                                                       |
| Auth          | Better Auth                                                   |
| Deployment    | Docker + Kamal + Hetzner                                      |
| CI/CD         | GitHub Actions                                                |

See [docs/decisions/](docs/decisions/README.md) for the full architecture rationale.

---

## Project Structure

```
apps/
  web/          # Vue 3 frontend (SPA)
  api/          # Hono backend
packages/
  shared/       # Zod schemas and shared types
docs/
  decisions/    # Architecture Decision Records (ADRs)
```

---

## Prerequisites

- [Docker](https://www.docker.com/) — for the devcontainer
- [VS Code](https://code.visualstudio.com/) + [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

All other tools (Node.js, pnpm, etc.) are provided inside the devcontainer.

---

## Local Development

1. Clone the repository
2. Open in VS Code — it will prompt to reopen in the devcontainer
3. The devcontainer runs `pnpm install` automatically on creation
4. Start the API: `pnpm --filter api dev`
5. Start the frontend: `pnpm --filter web dev`

---

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

## Design Principles

- Event-driven architecture
- Integration-first approach
- Secure-by-default operations
- Full audit logging of lifecycle events
- Idempotent workflows (safe retries)
- Multi-tenant with PostgreSQL Row-Level Security

---

## Security

- Least privilege access model
- Automatic revocation on offboarding
- No hardcoded credentials
- Full audit trail of all actions

---

## Contributing

- Read [CLAUDE.md](CLAUDE.md) for AI agent guidance and coding conventions
- Read [docs/decisions/](docs/decisions/README.md) before proposing architectural changes
- All commits must follow [Conventional Commits](https://www.conventionalcommits.org/)
- All commits must be GPG signed
- Work in feature branches — rebase onto `main`, open a PR, no direct pushes
