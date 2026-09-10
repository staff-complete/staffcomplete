# CLAUDE.md

AI agent guidance for this repository.

**What this repo is right now: a one-page early-access landing site.** The
employee-lifecycle platform it describes is not built here any more — it was
removed before the first customer, and lives at the `v0-full-app` tag and the
`archive/full-app` branch. See ADR-0023.

There is no database, no API server, no queue, no authentication, and no
authenticated application. The only backend is a single Cloudflare Pages
Function. Assume none of the platform machinery exists unless you have just
read it in the tree.

---

## Development environment

**All development — including CLI tools like `gh`, `ruby`, not just app code —
happens inside the devcontainer (`.devcontainer/`), never on the bare host.**
The host's `node_modules` is built for the container's platform, so running
`pnpm` outside it purges and reinstalls the wrong binaries.

If a tool seems missing, that means you're not in the devcontainer — it is not
a reason to `brew`/`apt-get install` it onto the host. If something is
genuinely missing from the devcontainer, add it to `.devcontainer/Dockerfile`
so it's versioned for everyone.

---

## Architecture

- **Monorepo**: pnpm workspaces + Turborepo.
  - `apps/web` — Vue 3 landing page, built by Vite to `apps/web/dist`
  - `functions` — Cloudflare Pages Functions; currently one, `POST /api/early-access`
  - `packages/shared` — the Zod schema both of the above parse
  - `docs/decisions` — ADRs
- **Non-default tooling** worth knowing before reaching for the usual default:
  **oxlint**/**oxfmt** (not ESLint/Prettier), **Vitest** for unit tests only
  (no E2E — don't add Playwright/Cypress), **Tailwind v4** via the Vite plugin.
- **Hosting**: Cloudflare Pages on the free tier, deployed by Cloudflare's own
  GitHub integration on push to `main`. There is no deploy workflow in this
  repo and no server to ssh into.
- ADRs live in `docs/decisions/` (indexed at `docs/decisions/README.md`).
  **ADRs are immutable** — never edit one; create a new one that supersedes it
  (or use the `new-adr` skill). Most ADRs below 0023 describe the archived
  platform: read ADR-0023 first to know which of them still bind.

### What the site does

A visitor reads the pitch and submits an email. The Pages Function validates
it, drops honeypot hits silently, and sends a notification through Resend.

**There is no signup store.** The notification inbox is the record — an email
that fails to send is a lead lost. Resend's free tier caps at 100 emails a day,
which is also the site's effective signup ceiling.

### Honesty constraint on landing copy

The page must not claim customers, usage numbers, shipped integrations, or
prices. There are none. Testimonials from invented people, a stats bar, and
"trusted by 200+ HR teams" were removed for exactly this reason — do not
reintroduce that kind of copy, in any wording, while the customer count is
zero.

---

## Code map — read before changing code

`docs/codemap/` is the architectural map of the repo: modules, what calls what,
and which tests cover each one. Three files, always generated together from one
commit — `codemap.json` (the graph, with source evidence for every claim),
`codemap.html` (self-contained interactive viewer), `codemap.lock` (commit,
working-tree state, and a fingerprint per top-level module).

**The map keeps itself up to date.** A `git commit` hook refreshes it and stages
it into the commit being made. A session-start hook reports its state. To check
or refresh by hand:

```sh
node .claude/hooks/codemap-refresh.mjs --check   # report only
node .claude/hooks/codemap-refresh.mjs           # refresh in place
```

It rewrites only when the map's claims change, never merely because a comment
or a test moved. Nodes, edges and flows are never invented by a script — when
the graph stops matching the tree, the commit hook refuses to rewrite and asks
you to re-author with the `codemap` skill.

**Before modifying a module**, use `docs/codemap/codemap.json` to answer: what
calls it, what it affects, which tests cover it. The `codemap` skill has the
exact `jq` for each.

---

## Git workflow

Trunk-based, no `dev` branch or staging environment (ADR-0013). `main` is the
only long-lived branch — every merge triggers Semantic Release (changelog +
GitHub Release), and Cloudflare Pages deploys the new commit on its own.

- **Signed commits required** (SSH signing, not GPG). **Rebase only** — no merge
  commits; linear history is enforced on `main`.
- Commits must be made **inside the devcontainer**: the husky pre-commit hook
  runs `pnpm`, which fails on the host.
- Create branches with the `start-issue` or `new-feature` skill, which apply the
  right `feat/`·`fix/`·`chore/`·`docs/` prefix.
- **Never commit directly to `main`.**
- **A PR must exist before pushing to `main`** — the branch ruleset only
  fast-forwards commits that belong to an open PR targeting `main`. Create the
  PR first: `gh pr create --base main`.
- **Never disable the ruleset** to force through a rejected push — a rejection
  means one of the rules above was broken; fix the process, not the protection.

**Merging a PR** (the `gh` token here lacks merge permissions, so merge locally):

```sh
git checkout main && git pull origin main
git merge <branch>   # fast-forward only, no merge commit
git push origin main
```

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), **one type per
commit** — never combine multiple `type: ...` concerns in one commit.

Types: `feat` `fix` `refactor` `test` `docs` `chore` `ci` `perf` `style` `revert`
Scopes: `web` `functions` `shared` `config`

- Subject ≤ 72 chars, lowercase, imperative mood, no trailing period
- Breaking change: `!` after type/scope, plus a `BREAKING CHANGE:` footer
- No `Co-authored-by: Claude` or other AI-attribution trailers

---

## Issues

Tracked as **GitHub Issues** only — no external tool. New issues auto-add to the
[project board](https://github.com/orgs/staff-complete/projects/1); closing or
updating an issue moves it there automatically, but you must update the issue
**label** and board **status** together — one doesn't push to the other.

| Type         | Template   | Use for                                            |
| ------------ | ---------- | -------------------------------------------------- |
| `user-story` | User Story | New capability from the HR user's perspective      |
| `bug`        | Bug Report | Something broken in production                     |
| `spike`      | Spike      | Time-boxed research with a defined question/output |
| `chore`      | (none)     | Maintenance, refactoring, tooling                  |

Labels: priority (`P0`–`P3`) · area (`area: <domain>`) · status (`needs-triage`
→ `status: ready` → `status: in-progress` → `status: blocked`/`wont-fix`/`released`)
· severity, bugs only (`severity: critical|high|medium|low`).

An issue is `status: ready` once it has a priority, an area label, and
acceptance criteria clear enough to start without more questions (severity too,
for bugs). Board status: Backlog = `needs-triage`, Ready = `status: ready`,
In progress = `status: in-progress`, Done = closed.

Pick up an issue with `gh issue develop <n> --checkout`, or the `start-issue`
skill. PRs reference the issue (`Closes #n`).

---

## Testing & code quality

- **Vitest** — unit tests only, no E2E. Tests live alongside source.
- `pnpm test` / `pnpm test:coverage` · `pnpm lint` (oxlint) · `pnpm format:check`
  (oxfmt) · `pnpm typecheck` · `pnpm cspell`
- All must pass before merging — run the `ci-check` skill locally to catch
  failures before pushing; Codacy and CodeQL also run automatically on PRs.
- The Pages Function is the only code with real consequences, so it carries the
  test suite. `apps/web` has no test files today, which is why the test scripts
  pass `--passWithNoTests`.

---

## Skills

`.claude/skills/` covers recurring workflows — prefer these over doing the
equivalent steps by hand:

`start-issue` · `new-feature` · `new-adr` · `domain-modeling` · `codemap` ·
`ci-check` · `release-check` · `security-check`

Skills for the archived platform (`new-integration`, `new-automated-action`,
`new-lifecycle-event`, `new-migration`) describe machinery this repo no longer
has. Leave them alone — they become relevant again if the platform comes back.
