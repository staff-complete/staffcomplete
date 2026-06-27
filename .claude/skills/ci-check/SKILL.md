# Skill: ci-check

Run all CI checks locally before pushing to catch issues early.

## Steps

Run the following in order, stopping on first failure:

1. **Spell check** — `pnpm cspell`
2. **Lint** — `pnpm lint` (oxlint across all apps and packages)
3. **Format** — `pnpm format:check` (oxfmt)
4. **Type check** — `pnpm typecheck` (vue-tsc for apps/web, tsc for apps/api and packages/shared)
5. **Tests** — `pnpm test` (Vitest across all apps and packages)

## Report

After all checks:

- List which checks passed and which failed
- For failures, show the relevant error output
- Suggest fixes for common issues

## Notes

- All checks must pass before opening a PR — the same checks run in GitHub Actions
- Turborepo caches results — unchanged packages are skipped automatically
- If a check fails in CI but passes locally, check for environment differences (Node version, env vars)
