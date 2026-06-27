# Skill: new-feature

Set up a new feature branch following the project's git strategy.

## Steps

1. **Get the feature description** from the user if not provided
2. **Derive the branch name** — format: `feat/kebab-case-description` (e.g. `feat/slack-provisioning`)
   - For bug fixes: `fix/kebab-case-description`
   - For chores: `chore/kebab-case-description`
3. **Ensure `main` is up to date** — run `git fetch origin main`
4. **Create and switch to the branch** — run `git checkout -b <branch-name> origin/main`
5. **Confirm** — show the branch name and remind the developer of:
   - Commits must be GPG signed (`git config commit.gpgsign true`)
   - Follow Conventional Commits: `feat(scope): description`
   - Keep commits atomic — one concern per commit
   - Rebase onto `main` before opening a PR (`git rebase origin/main`)

## Branch naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/description` | `feat/google-workspace-integration` |
| Bug fix | `fix/description` | `fix/offboarding-rls-policy` |
| Chore | `chore/description` | `chore/bump-drizzle` |
| Docs | `docs/description` | `docs/add-auth-adr` |

## Scopes for commit messages

`onboarding`, `offboarding`, `role-change`, `access`, `integrations`, `workflows`, `auth`, `api`, `db`, `config`
