# Skill: release-check

Verify the codebase is ready for release before merging to `main`.

## Steps

1. **Git status** — ensure no uncommitted changes: `git status`
2. **Branch check** — confirm you are on the feature branch, not `main`
3. **Rebase check** — ensure the branch is rebased onto latest `main`: `git fetch origin main && git rebase origin/main --dry-run`
4. **Run CI checks** — run the `ci-check` skill (lint, typecheck, tests)
5. **Commit message audit** — validate all commits on the branch follow Conventional Commits:
   - Run `git log origin/main..HEAD --oneline` to list branch commits
   - Check each message: type must be valid, subject ≤ 72 chars, lowercase, no trailing period
6. **Preview semantic-release version bump** — based on commit types:
   - `fix` commits → patch bump
   - `feat` commits → minor bump
   - `feat!` or `BREAKING CHANGE` footer → major bump
   - Report what the next version would be
7. **Signed commits check** — verify all commits are GPG signed: `git log origin/main..HEAD --show-signature`

## Report

Produce a checklist:

- [ ] No uncommitted changes
- [ ] Branch rebased onto main
- [ ] Lint passes
- [ ] Type check passes
- [ ] Tests pass
- [ ] All commit messages follow Conventional Commits
- [ ] All commits are GPG signed
- [ ] Expected version bump: vX.Y.Z

If all checks pass: ready to open a PR.
If any fail: list what needs fixing.
