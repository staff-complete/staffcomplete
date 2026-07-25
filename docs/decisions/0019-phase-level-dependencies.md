# ADR-0019: Phase-Level Dependencies

- **Status:** accepted
- **Date:** 2026-07-25

## Context

ADR-0017 modeled a checklist as phases running strictly in sequence by
`position`, with steps inside a phase running in parallel. That covers "day
1 tasks, then week 1 tasks," but not the shape a real onboarding usually
takes: several independent branches (IT, Office, Admin, Payroll) start at
the same time and only need to converge once, before a single later phase
(e.g. "First day"). One branch can additionally have its own internal
sequencing (Payroll can't process the hire until documents are collected)
that has nothing to do with the other branches.

A single linear `position` order can't express this. The only way to model
"Payroll waits on Documents" today is to pull Documents out into its own
phase _before_ the shared prep phase — which forces IT, Office, and Admin to
wait on Documents too, even though none of them depend on it. Concretely, in
a real onboarding template seen in testing, the phase that starts "First
day" work needs to wait on four _different_ branches finishing, not one
predecessor — something `position`-based locking has no way to say.

**Alternative considered and rejected:** per-step dependencies
(`dependsOnStepIds`, an arbitrary DAG at the step level, cutting across
phases). ADR-0017 already flagged this as the more expressive option and
deferred it for being too large: a full edge table between steps, cycle
detection at that granularity, and an editor UI for picking arbitrary steps
out of the whole template rather than checking boxes in a short phase list.
Every real case seen so far — parallel branches converging at a sync
point — is expressible at the phase level. Per-step dependencies remain
possible to layer on top of phases later, same as ADR-0017 already noted,
for the smaller set of cases phases genuinely can't express.

## Decision

Phases declare explicit dependencies on other phases — a many-to-many edge
list, not a position comparison. A phase with zero declared dependencies is
a root: it's unlocked as soon as the template/run starts. A phase with
several declared dependencies (the "First day" example above) unlocks only
once _every_ phase it depends on is complete. This directly expresses both
parallel branches and multi-way convergence, which position-based ordering
cannot.

**Schema:** two new join tables, mirroring the existing
template/run split (`workflowTemplatePhase` → `runPhase`):

```
workflow_template_phase_dependency (id, phaseId, dependsOnPhaseId, organizationId)
run_phase_dependency               (id, phaseId, dependsOnPhaseId, organizationId)
```

Both `phaseId` and `dependsOnPhaseId` reference the respective phase table
(`ON DELETE CASCADE` on both columns — deleting either phase in an edge
removes the edge). `organizationId` is denormalized on both, same reasoning
as every other tenant-scoped table since ADR-0005: RLS policies can't join
through `phaseId` to reach the tenant column. A unique constraint on
`(phaseId, dependsOnPhaseId)` prevents duplicate edges.

**`position` is kept, but demoted to display order only.** It still
controls the order phases are _listed_ in the editor and in a run's phase
list, but it no longer participates in unlock logic at all. This was
considered and rejected: inferring order from a topological sort of the
dependency graph, so `position` could be dropped entirely. Rejected because
a DAG with parallel branches has no single valid topological order — IT and
Office are siblings with no ordering between them — so _something_ has to
say which one is listed first in the UI, and a stored `position` is simpler
than an arbitrary tie-break rule bolted onto the sort.

**Locking becomes a direct dependency check, not a positional walk.** A
phase is unlocked iff every phase in its `dependsOnPhaseId` set is "fully
complete." Fully complete has to be defined recursively, not just as "this
phase's own steps are all `completed`": a phase with _zero_ steps of its
own is vacuously complete regardless of whether it was ever itself
unlocked, so a non-recursive check would let an empty phase in the middle
of a chain silently wave through anything depending on it, even while that
empty phase's _own_ dependencies are still unfinished. So "fully complete"
means "this phase's own steps are all completed, **and** everything it
depends on is also fully complete" — recursing back through the graph,
memoized per phase, terminating because the graph is guaranteed acyclic
(see cycle detection below). This is the direct generalization of the old
position-walk's "break at the first incomplete phase," which got the same
answer for free by construction (a strictly ordered chain has only one path
to recurse along); a DAG with real branching needs the recursion made
explicit. `computeUnlockedPhaseIds` in `packages/shared/src/phase.ts`
changes from "sort by position, walk, break on first incomplete" (single
input: ordered phases) to "for each phase, check whether its declared
dependencies are fully complete" (two inputs: phases and dependency
edges) — and stops depending on order at all, which is what makes
converging branches expressible.

**Cycle detection happens at write time, in the API, not the database.**
Postgres has no clean way to reject "this insert would create a cycle" via
a constraint. The dependency-setting endpoint
(`PUT /:id/phases/:phaseId/dependencies`, body `{ dependsOnPhaseIds }`,
replacing the _full_ set for that phase in one call — same pattern as the
existing `/:id/phase-order` and `/:id/phases/:phaseId/steps/order`
endpoints, which already replace a full ordered set rather than diffing) runs
a graph-reachability check before writing: if any proposed `dependsOnPhaseId`
can already reach `phaseId` by following existing edges, the edge would
close a cycle and the request is rejected with `400 CYCLE_DETECTED`. Also
rejects a phase depending on itself, and any `dependsOnPhaseId` that isn't a
phase belonging to the same template. The same reachability check is
exported from `packages/shared/src/phase.ts` so it's exercised by unit
tests independent of the route, following the same "pure function shared by
apps/api and apps/web" pattern as `computeUnlockedPhaseIds`/`isStepLocked`.

**Migration is a single expand step, not expand/contract.** Unlike ADR-0017's
`phaseId` column (which had to ship nullable, then get tightened to
`NOT NULL` in a follow-up deploy, specifically because tightening an
existing column is unsafe to do in the same deploy that starts writing it),
this only _adds_ two new tables — there's no existing column changing shape
under in-flight code. The migration creates both tables and backfills a
dependency edge for every existing phase pointing at the previous phase by
position (`phase[i] depends_on phase[i-1]`), so every template and run that
exists today keeps behaving exactly as it does now — a `position`-ordered
chain — the moment the new code deploys. Phase 0 in each template/run gets
no backfilled edge, matching its current "unlocked immediately" behavior.

Because Kamal migrations run before the new container starts serving
(ADR-0008's pre-deploy migration hook), the new dependency-based
`computeUnlockedPhaseIds` never runs against a phase that lacks its
backfilled edges. The one narrow gap is a phase _created_ by the
still-draining old container in the brief window between migration and
cutover — it would get zero dependency rows, since old code doesn't know
the new table exists. Unlike ADR-0017's equivalent gap, this isn't a
correctness bug: a phase with no edges is a **root**, so the failure mode is
"this one phase unlocks immediately instead of waiting on its intended
predecessor" — permissive, self-correcting on the next edit in the editor,
and bounded to a single-digit-second deploy window. Not worth a second
deploy to close.

**Editor UI:** `PhaseCard.vue` gets a "depends on" control — a checklist of
the template's other phases — alongside the existing rename/delete/position
controls. Up/down reordering is kept for `position` (display order), but no
longer implies a locking relationship; a newly created phase defaults to
depending on nothing (a root), not on "the previous phase," since with
parallel branches there's no longer a single obvious default. The client
also runs the same reachability check before submitting, purely so the
checkbox for an already-cycle-forming phase can be disabled instead of
round-tripping to the server to find out — the server check in the route
handler remains the actual enforcement.

## Consequences

- `computeUnlockedPhaseIds`'s signature changes (adds a `dependencies`
  parameter); every caller (`runs.ts`, `tasks.ts`, `run-steps.ts`) has to
  fetch and pass the relevant dependency rows alongside phases and steps.
- Two more tenant-scoped tables need the explicit `GRANT` in
  `setup-tenant-role.ts` — ADR-0017 already called out that this step is
  easy to forget since `ALTER ROLE` only re-applies what's listed there.
- A template with no dependencies configured behaves like today's flat list
  only if the backfill/default actually chains phases — an admin who adds a
  brand-new phase and forgets to set a dependency gets a root phase (usable
  immediately), not a blocked one. This is a deliberate default (explicit
  over implicit) but is a behavior change from ADR-0017's "always chained
  by position" and needs to be visible in the editor UI, not just correct
  in the API.
- Per-step cross-phase dependencies are still not expressible — that
  remains the deferred, larger feature both this ADR and ADR-0017 decline
  to build.
