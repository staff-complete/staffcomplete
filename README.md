# Staff Lifecycle Automation Platform

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/ca00fbb9714f490483fdf1363f8fd8d1)](https://app.codacy.com/gh/staff-complete/staffcomplete/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/ca00fbb9714f490483fdf1363f8fd8d1)](https://app.codacy.com/gh/staff-complete/staffcomplete/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

A SaaS platform for automating the full employee lifecycle across company systems — from onboarding to offboarding and everything in between.

> Every employee state change should automatically reflect across all company systems — safely, consistently, and with a full audit trail.

---

## Status: early access

**This repository currently builds one thing — the early-access landing page at
[staffcomplete.io](https://staffcomplete.io).** The platform described below is
the product we intend to build; it is not running here.

A first version of it was built and then removed before the first customer,
because a platform with no users costs money and attention to keep alive and
returns neither. It is preserved in full at the `v0-full-app` tag and the
`archive/full-app` branch, and the reasoning is recorded in
[ADR-0023](docs/decisions/0023-early-access-landing-until-first-customer.md). The page collects early-access requests until
there is someone to build for.

---

## What the product will do

- Employee onboarding
- Role and permission changes
- Offboarding and access removal
- Cross-system provisioning (Google Workspace, Slack, GitHub, and other integrated tools)

Every employee state change should automatically reflect across all company
systems — safely, consistently, and with a full audit trail. The vocabulary for
all of it is in [CONTEXT.md](CONTEXT.md).

---

## What is in this repository today

| Layer    | Choice                                                   |
| -------- | -------------------------------------------------------- |
| Frontend | Vue 3 + Tailwind v4, built by Vite to static files       |
| Backend  | One Cloudflare Pages Function (`POST /api/early-access`) |
| Storage  | None. A signup is delivered as email via Resend          |
| Hosting  | Cloudflare Pages, free tier, deployed from `main`        |

There is no database, API server, job queue or authentication. The archived
platform's stack — Hono, tRPC, Drizzle, PostgreSQL with row-level security,
pg-boss, Better Auth, Kamal on Hetzner — and the rationale for each choice is
recorded in [docs/decisions/](docs/decisions/README.md) (ADRs). Read ADR-0023
first: it says which of the earlier decisions still bind.

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
4. Start the landing page: `pnpm --filter web dev`

The Pages Function does not run under Vite. It is covered by unit tests
(`pnpm test`), and every pull request gets a Cloudflare preview deployment
where the form works end to end.

---

## Contributing

Contributions go through feature-branch PRs against `main`, following
[Conventional Commits](https://www.conventionalcommits.org/). For exact branch
naming, commit scopes, commit-signing setup, and CI commands, see
[CLAUDE.md](CLAUDE.md) — the single source of truth for repo workflow, kept in
sync with the skills in `.claude/skills/`.

## License

[Business Source License 1.1](LICENSE.md) — © Andrew Molyuk
