# Skill: start-issue

Pick up a GitHub issue and get a branch ready to code on.

## Steps

1. **Get the issue number** from the user if not provided

2. **Fetch the issue** — run:

   ```bash
   gh issue view <number> --json number,title,labels,assignees
   ```

3. **Determine the branch type** from the issue's labels:
   - `bug` → `fix/`
   - `user-story` → `feat/`
   - `chore` or `docs` → use that prefix
   - No label match → default to `feat/`, tell the user

4. **Derive the branch name**:
   - Take the issue title, lowercase it, replace spaces and special characters with hyphens, strip leading/trailing hyphens
   - Format: `<type>/<issue-number>-<slugified-title>`
   - Example: issue #42 "Add Slack provisioning step" → `feat/42-add-slack-provisioning-step`
   - Keep it under 60 characters total; truncate the slug if needed

5. **Ensure `dev` is up to date**:

   ```bash
   git fetch origin dev
   ```

6. **Create and switch to the branch**:

   ```bash
   git checkout -b <branch-name> origin/dev
   ```

7. **Assign the issue to yourself and mark it in progress**:

   ```bash
   gh issue edit <number> --add-assignee @me
   gh issue edit <number> --add-label "status: in-progress"
   gh issue edit <number> --remove-label "needs-triage"
   ```

8. **Confirm** — show a summary:
   - Issue: #number — title
   - Branch: branch-name
   - Remind the developer:
     - Commits must be GPG signed
     - Follow Conventional Commits: `<type>(<scope>): description`
     - Relevant scopes for this issue's domain area (read from `area:` label if present)
     - Rebase onto `dev` before opening a PR — PRs target `dev`, never `main`
     - PR description should include `Closes #<number>`

## Branch naming

| Issue label  | Branch prefix | Example                                 |
| ------------ | ------------- | --------------------------------------- |
| `bug`        | `fix/`        | `fix/37-correct-offboarding-rls-policy` |
| `user-story` | `feat/`       | `feat/42-add-slack-provisioning-step`   |
| `chore`      | `chore/`      | `chore/55-bump-drizzle`                 |
| `docs`       | `docs/`       | `docs/61-add-auth-adr`                  |

## Commit scopes by domain area

| Issue `area:` label  | Commit scope   |
| -------------------- | -------------- |
| `area: onboarding`   | `onboarding`   |
| `area: offboarding`  | `offboarding`  |
| `area: role-change`  | `role-change`  |
| `area: access`       | `access`       |
| `area: integrations` | `integrations` |
| `area: workflows`    | `workflows`    |
| `area: auth`         | `auth`         |
| `area: api`          | `api`          |
| `area: db`           | `db`           |
| `area: config`       | `config`       |

## Notes

- If the `gh` CLI is not authenticated, prompt the user to run `gh auth login` first
- If the issue is already assigned to someone else, warn before reassigning
- This skill complements `release-check`, which handles the other end of the workflow (PR readiness)
