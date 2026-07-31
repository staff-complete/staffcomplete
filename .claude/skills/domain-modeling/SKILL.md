---
name: domain-modeling
description: Build and sharpen this project's domain model — pin down a term, resolve competing names for one concept, keep the glossary and CLAUDE.md's Core Domain Model honest against the code, and decide when a modelling choice earns an ADR. Use when naming a new domain concept, when two words are in play for one thing, or when another skill needs to record a domain term.
---

# Skill: domain-modeling

Actively shape the ubiquitous language — challenge terms, stress-test them with concrete
scenarios, and write the result down the moment it crystallises.

This is for **changing** the model. Just reading the glossary for vocabulary is a one-line
habit any skill can do; that's not this skill.

## Where the model lives

| Artefact                    | Holds                                                | Rule                                       |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `CONTEXT.md` (repo root)    | The glossary — terms and their canonical names       | The single source of domain vocabulary     |
| CLAUDE.md Core Domain Model | The short list of lifecycle events + system concepts | Keep in sync; it's the index, not the body |
| `docs/decisions/`           | Modelling decisions that were real trade-offs        | Immutable — supersede, never edit          |
| `packages/shared/src/*.ts`  | Zod schemas — the executable source of truth         | Code must agree with the glossary          |

This repo is a **single bounded context**. Don't introduce a context map or per-context
glossaries — one product, one language.

## During the session

**Challenge against the glossary.** When a term conflicts with a settled one, say so
immediately: "The glossary calls this a Run — you said 'instance'. Same thing, or new?"

**Sharpen fuzzy language.** Propose a precise canonical term for vague or overloaded ones.
"You said 'template' — the checklist template, or the email template?"

**Stress-test with scenarios.** Invent concrete edge cases that force the boundary between
two concepts into the open. An employee changing role mid-onboarding, a run whose template
was edited after launch, an offboarding for someone who never onboarded.

**Cross-reference with code.** A stated rule that the code contradicts is the highest-value
find. Check `packages/shared`, `apps/api/src/db/schema.ts`, and the i18n locale files before
accepting a claim about how something works.

**Write it down inline.** When a term resolves, update the glossary right then — don't batch.

## Naming a concept: the cost gate

Renaming is cheap in code and expensive at the edges. Before proposing a rename, price it:

1. **Zod schema** (`packages/shared/src/`) — the type source of truth; start here, it propagates
2. **i18n** — a user-facing term means **all three** locales (`en.ts`, `ru.ts`, `he.ts`, ADR-0016).
   Locale keys are not the term; a term change may not need a key change. Hebrew is RTL.
3. **DB columns/tables** (`apps/api/src/db/schema.ts`) — a rename is a **migration**, must be
   backward-compatible with the running version (migrations are a Kamal pre-deploy hook,
   ADR-0004/0008). Often the right call is to leave the column and fix only the language above it.
4. **CLAUDE.md** — update Core Domain Model if a lifecycle event or system concept changed

If a term is only wrong in the UI, fix the UI. Don't cascade a rename into a migration
unless the DB name is actively misleading someone.

## Glossary format

```markdown
# Domain Glossary

The ubiquitous language for StaffComplete. Terms here are canonical — code, UI copy, and
docs use these words. Implementation details do not belong in this file.

## Checklists and runs

**Run**:
One execution of a checklist template for one employee. Carries the employee's details and
the event date.
_Avoid_: instance, job, process

**Checklist Template**:
A reusable checklist an organization builds up-front and launches runs from.
_Avoid_: workflow, playbook, process
```

Rules:

- **Be opinionated.** One concept, one word. Every rejected synonym goes under `_Avoid_`.
- **Tight definitions.** One or two sentences. Define what it **is**, not what it does.
- **Domain terms only.** Anything a general programmer would already know (queue, retry,
  migration) stays out, however heavily this project uses it.
- **No implementation detail.** Not a spec, not a scratchpad. A glossary and nothing else.
- Group under subheadings when clusters emerge; a flat list is fine while it's short.

Optional trailers, used sparingly:

- `_Status_:` — the term is agreed but nothing implements it yet (e.g. Role Change)
- `_In code_:` — identifiers still carry an older name; the language moved first, deliberately.
  Not an invitation to rename — see the cost gate above
- `_Unresolved_:` — the name itself is contested; point at the `## Unresolved` section

**Never silently pick a winner** on a live disagreement. If two words are genuinely in play,
write the entry under the name the code uses and record the conflict in an `## Unresolved`
section at the foot of the file — one bullet, naming both sides and what would settle it.
Resolving one means deleting its bullet and demoting the loser to `_Avoid_`. That section and
the `_In code_` trailer are the only places in `CONTEXT.md` allowed to reference code.

**When the users' word and the code's word differ, the users' word wins.** The glossary
follows the domain, not the schema; identifiers are free to lag behind it under `_In code_`.
Retiring a word outright — because the concept turned out not to exist — goes under
`## Retired terms` instead, so a reader meeting it in old code knows it means nothing.

## When to write an ADR

Offer one only when **all three** hold:

- **Hard to reverse** — data model, public API shape, or a word users learn
- **Surprising without context** — a future reader will ask "why this way?"
- **A real trade-off** — genuine alternatives existed and one won for stated reasons

Miss any one, and the glossary entry is the whole record. Naming a concept is usually a
two-way door; carving up an aggregate usually isn't.

To write it, use the `new-adr` skill — it numbers the file and updates the index. ADRs are
immutable: supersede, never edit.

## Starting a session

Read `CONTEXT.md` first — its `## Unresolved` section is the live backlog of contested names.
If the topic at hand touches one of them, that's the moment to settle it, not to route around it.

Watch for the three ways the model rots here:

- **UI copy drifting from the schema** — the locale files are where a synonym takes hold
  unnoticed, because nothing type-checks English
- **CLAUDE.md claiming concepts the code doesn't have** — its Core Domain Model is hand-written
  and can outrun the schema
- **One word covering two concepts across layers** — the reason a term is "reserved" in the
  glossary is usually that a second meaning is coming
