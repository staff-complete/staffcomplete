# CLAUDE.md

This file defines guidance for AI agents working in this repository.

## Project Overview

This project is a SaaS platform for **employee lifecycle management**, including:

- onboarding automation
- offboarding automation
- access provisioning and deprovisioning
- role and permission changes across company systems
- lifecycle event orchestration across HR + IT systems

The system ensures that employee state changes are consistently reflected across all integrated tools (e.g. Google Workspace, Slack, GitHub, internal systems).

---

## Core Domain Model

### Employee Lifecycle Events
- `onboarding`
- `role_change`
- `offboarding`

### System Concepts
- Employee
- Access Control
- Integrations (external SaaS tools)
- Workflows
- Event-driven automation

---

## Commit Message Convention

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that is neither a fix nor a feature
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — build process, tooling, dependencies
- `ci` — CI/CD configuration
- `perf` — performance improvement
- `style` — formatting, whitespace (no logic change)
- `revert` — reverts a previous commit

**Scopes** (optional, use the affected domain area):
- `onboarding`, `offboarding`, `role-change`
- `access`, `integrations`, `workflows`
- `auth`, `api`, `db`, `config`

**Examples:**
```
feat(onboarding): add Slack workspace provisioning step
fix(access): correct deprovisioning order for GitHub org removal
chore(deps): bump @types/node to 20.x
```

**Rules:**
- Subject line ≤ 72 characters, lowercase, no trailing period
- Use imperative mood ("add", not "added" or "adds")
- Breaking changes: append `!` after the type/scope and add a `BREAKING CHANGE:` footer
- **One type per commit** — never combine multiple `type: ...` lines into a single commit message. If changes span multiple concerns, create separate commits.
- **No AI co-author trailers** — do not add `Co-authored-by: Claude` or any AI attribution to commit messages.

---
