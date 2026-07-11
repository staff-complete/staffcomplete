# ADR-0013: Trunk-Based Development, Single Environment

- **Status:** accepted
- **Date:** 2026-07-11

## Context

The repo had a `dev` branch that auto-deployed to `dev.staffcomplete.io`, sitting between feature branches and `main`. This was never actually decided in an ADR — ADR-0008 (Deployment) only ever specified "deploy automatically on push to `main`" — it grew organically (commit `1aefe8e` moved the `start-issue` skill's base branch from `main` to `dev`; `efa3740` documented the resulting PR rules) without anyone weighing whether a second environment was worth its ongoing cost.

While implementing RLS (ADR-0012) and hardening SSH access, that cost became concrete: every environment-scoped piece of infrastructure — Postgres roles, RLS setup, `TENANT_DATABASE_URL`/`APP_DB_PASSWORD`-equivalent secrets, Kamal config — had to be provisioned and reasoned about twice. Checking on the `dev` deployment in the course of that work found its Postgres accessory had been silently crash-looping (`POSTGRES_PASSWORD` unset at first init) for an unknown period — the environment meant to catch problems before production wasn't being watched closely enough to catch its own failure to exist.

The project is pre-launch with no real users on either environment, and has effectively one active developer. A staging environment's main value — catching bugs before real users see them — isn't being realized when nobody's exercising it, and the maintenance cost (double the secrets, double the Postgres role setup, double the Kamal config, a second SSH-reachable environment to keep patched) is being paid regardless.

## Decision

Drop `dev` as a branch and as a deployed environment. Development is trunk-based:

```
feature/* ──► main ──► staffcomplete.io (+ GitHub Release)
```

- Feature branches target `main` directly and merge via PR (same rules as before: signed commits, fast-forward only, linear history).
- Merging to `main` triggers Semantic Release and a production Kamal deploy immediately — there's no intermediate integration step.
- The safety net is `kamal deploy`'s built-in rollback (`kamal rollback`) plus small, frequent PRs, not a pre-production buffer. A bad deploy is a rollback away, not a "catch it in dev first" problem.
- `config/deploy.dev.yml` and `.github/workflows/deploy-dev.yml` are deleted; Kamal's destination-overlay mechanism (introduced for the dev/prod split) is no longer needed since there's only one destination — `config/deploy.yml` is used directly, with no `-d` flag.
- Every environment-scoped resource that previously needed provisioning twice (Postgres roles, RLS grants, `TENANT_DATABASE_URL`, GitHub environment secrets) now only exists once.

This doesn't change anything about ADR-0012's RLS design or ADR-0008's deployment mechanics — it removes the second instance of both.

## Consequences

- No environment to manually poke at before a change reaches real users — a migration, an RLS policy, or a config change is validated locally and in CI, then it's live.
- Meaningfully lowers ongoing maintenance: one Postgres accessory, one set of secrets, one Kamal config, one thing to keep patched and watched.
- If this project gains real customers or multiple concurrent contributors, revisit this — a shared integration point becomes more valuable exactly when "just roll back" stops being an acceptable answer for user-facing breakage. That's a new ADR when it happens, not a reason to keep `dev` around unused now.
- Local development is unaffected — the devcontainer's local Postgres and `pnpm dev` workflow have nothing to do with the deployed `dev` environment being removed here.
