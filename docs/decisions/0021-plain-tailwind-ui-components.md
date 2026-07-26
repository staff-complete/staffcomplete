# ADR-0021: Plain Tailwind Instead of Shadcn/vue for UI Components

- **Status:** accepted
- **Date:** 2026-07-26

## Context

ADR-0002 chose Shadcn/vue as the component primitive layer on top of Tailwind. In practice it was never adopted: `apps/web` has no Shadcn/vue files, no Radix dependency, and no reference to it anywhere in the frontend. Every component built so far (`apps/web/src/components/`) is hand-written Tailwind. The decision to skip Shadcn/vue and use plain Tailwind was made during development but never recorded, leaving ADR-0002 as the only place still documenting Shadcn/vue as the plan.

## Decision

Build UI components with plain Tailwind utility classes, not Shadcn/vue. No component primitive library is used.

**Alternative considered:** adopt Shadcn/vue as ADR-0002 originally specified. Rejected in practice — for this project's component surface so far, copying and maintaining a primitives layer added more overhead than it saved, and hand-written Tailwind components have been sufficient.

## Consequences

- ADR-0002 is **partially superseded** by this ADR for its UI component library line only — the rest of its frontend stack choices (Vue 3, Vite, Vue Router, Pinia, TanStack Query, Tailwind, date-fns) are unaffected and remain accurate.
- New components are written directly in Tailwind rather than copied from a Shadcn/vue primitive.
- If component complexity grows enough to justify a primitives layer later, that's a new ADR weighing Shadcn/vue against alternatives at that time, not a reason to revert silently.
