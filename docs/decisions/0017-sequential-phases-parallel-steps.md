# ADR-0017: Sequential Phases with Parallel Steps

- **Status:** accepted
- **Date:** 2026-07-24

## Context

Onboarding/offboarding checklists (`workflowTemplate`/`workflowTemplateStep`,
added in #22) were a flat list ordered by a single `position` column. Real
lifecycle events aren't linear: some steps can happen at the same time
(ordering equipment, collecting paperwork), while others genuinely gate one
another (access revocation shouldn't start until equipment is returned and
knowledge transfer is confirmed). A flat ordered list can't express "these
three can happen in any order, but none of them start until that earlier
group is done" — it can only force an arbitrary total order or leave
sequencing unenforced entirely.

## Decision

Introduce a **phase** as a first-class concept between a template/run and its
steps: `workflowTemplatePhase`/`runPhase`, ordered by `position`, with steps
referencing a `phaseId`. Steps within a phase can be completed in any
order (parallel); phases themselves run in sequence — a phase only becomes
actionable once every step in every earlier phase is `completed`.

Lock state is **computed, not stored** — `computeUnlockedPhaseIds` in
`packages/shared/src/phase.ts` walks phases in `position` order and returns
the set of phases where every step in every prior phase is complete. This is
the same "compute live, don't trust stale state" pattern as
`isTaskOverdue` (`task.ts`) and the trial-expiry rule (ADR-0015) — storing a
`status` column on the phase tables would just create a sync bug waiting to
happen the first time a step completion forgets to update it. The API
enforces this too: `tasks.ts`'s step-completion endpoint checks
`isStepLocked` server-side and rejects with `403 PHASE_LOCKED`, so the lock
isn't just a UI nicety.

**Alternative considered:** a step-level dependency graph (`dependsOnStepIds`
per step, forming a DAG) is strictly more expressive — it can model a
dependency that cuts across phases, or differs between two steps in what
would otherwise be the same phase. It was rejected for now because it's
substantially more complex to build (cycle detection, a harder editor UI
than drag-to-reorder within a phase, a real migration story) for cases the
phase model doesn't actually need yet. Phase grouping covers the common
real-world shape — "day 1 tasks," "week 1 tasks" — with a fraction of the
mechanism. `dependsOn` can be layered on top of phases later for the small
number of cases phases can't express, without displacing this model.

**Migration was expand/contract, not a single step**, because every merge to
`main` triggers an immediate production deploy with no staging environment
(ADR-0008, ADR-0013). `phaseId` shipped nullable with a backfill (#94) so
the phase-aware write paths could deploy safely; it was only tightened to
`NOT NULL` (#95) once that code had been live long enough that every row
was guaranteed to have it. Bundling both in one deploy would have
reintroduced exactly the risk the split exists to avoid: old, still-running
code inserting a step with no `phaseId` in the window before new code takes
over.

## Consequences

- Editor UI complexity grows: phase CRUD (create/rename/reorder/delete) and
  per-phase step lists, instead of one flat list.
- A step's `dependsOn` is implicitly "every step in every earlier phase" —
  genuinely per-step cross-phase dependencies aren't expressible without the
  DAG extension described above.
- **New tenant-scoped tables need an explicit `GRANT` in
  `setup-tenant-role.ts`, not just a `pgPolicy`** — this has now bitten the
  project twice (`subscription`, per ADR-0015's note, and again for
  `workflow_template_phase`/`run_phase` here, caught only by driving the
  live API against a real dev server rather than trusting the mocked route
  tests). Worth checking explicitly, every time, when a migration adds a
  table.
- **Route shape constraint surfaced while adding phase-reorder endpoints:**
  a literal path segment and a `:param` at the same depth under the same
  HTTP method (e.g. `PUT /:id/phases/order` alongside
  `PUT /:id/phases/:phaseId/steps/order`) is a shape Hono's `RegExpRouter`
  can't compile. It throws `UnsupportedPathError` building the matcher,
  which makes `SmartRouter` silently fall back to `TrieRouter` for the
  _entire_ app — which then resolves the unrelated `/api/auth/**` wildcard
  mount differently and broke sign-in/sign-up outright, with no error
  surfaced anywhere. Worked around by naming the route `/phase-order`
  instead; `apps/api/src/index.test.ts` now has a regression test that
  actually exercises route resolution (`app.request(...)`) rather than only
  checking the module imports, specifically because this class of bug
  wouldn't otherwise be caught by any existing test.
- Automated steps' phase locking is enforced server-side today, but there's
  still no execution engine for `type: 'automated'` steps (see ADR-0018) —
  locking currently only gates _manual_ step completion in practice.
