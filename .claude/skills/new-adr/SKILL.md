# Skill: new-adr

Create a new Architecture Decision Record (ADR) for this project.

## Steps

1. **Find the next number** — list files in `docs/decisions/`, find the highest `XXXX-` prefix, increment by 1, zero-pad to 4 digits
2. **Ask for the title** if not provided — use imperative mood, e.g. "Use Redis for caching"
3. **Create the file** at `docs/decisions/XXXX-kebab-case-title.md` using this structure:

```markdown
# ADR-XXXX: Title

- **Status:** accepted
- **Date:** YYYY-MM-DD (today's date)

## Context

What problem, constraint, or situation prompted this decision?

## Decision

What was decided and why? Include alternatives considered and why they were rejected.

## Consequences

What becomes easier or harder as a result of this decision? List trade-offs honestly.
```

4. **Update the index** — add a row to the table in `docs/decisions/README.md`:

```markdown
| [XXXX](XXXX-kebab-case-title.md) | Title | accepted |
```

5. **Confirm** — show the created file path and the updated index row

## Rules

- Status is always `accepted` unless the user says otherwise
- Never edit an existing ADR — create a new one that supersedes it and update the old one's status to `superseded by [ADR-XXXX](XXXX-title.md)`
- Keep ADRs concise — one page max
