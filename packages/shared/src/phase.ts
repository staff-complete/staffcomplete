// Which phases are unlocked to work on, derived from step completion and
// explicit phase dependencies rather than stored — same "compute live,
// don't trust stale state" pattern as computeTrialState (ADR-0015) and
// isTaskOverdue (./task.ts). A phase with no declared dependencies is a
// root and unlocks immediately; a phase with dependencies unlocks once every
// step in every phase it depends on is completed. `position` no longer
// participates in this at all (ADR-0019 demoted it to display order only —
// see ADR-0017 for the position-only predecessor of this model). Shared by
// apps/api (run detail + task completion) and apps/web (locked-phase UI,
// editor cycle check) so they can't disagree about what's unlocked.

export interface PhaseNode {
  id: string
}

export interface PhaseDependencyEdge {
  phaseId: string
  dependsOnPhaseId: string
}

export interface PhaseScopedStep {
  // null covers steps created before phases existed (backfilled rows, or a
  // stale write during the ADR-0017 migration's expand window) — treated as
  // unconstrained rather than blocking any phase.
  phaseId: string | null
  status: string
}

// "Complete" has to recurse through the dependency graph, not just check a
// phase's own steps — a phase with *no* steps of its own is vacuously
// complete regardless of whether it was ever itself unlocked (see the
// "empty middle phase" case inherited from ADR-0017), so without recursing,
// an empty phase would silently bypass an unfinished ancestor further back
// in the chain. Completion is memoized per phase and the recursion
// terminates because the dependency graph is guaranteed acyclic —
// wouldCreateCycle below is what enforces that at write time. See ADR-0019.
export function computeUnlockedPhaseIds(
  phases: PhaseNode[],
  dependencies: PhaseDependencyEdge[],
  steps: PhaseScopedStep[],
): Set<string> {
  const stepsByPhase = new Map<string, PhaseScopedStep[]>()
  for (const step of steps) {
    if (step.phaseId === null) {
      continue
    }
    const existing = stepsByPhase.get(step.phaseId)
    if (existing) {
      existing.push(step)
    } else {
      stepsByPhase.set(step.phaseId, [step])
    }
  }

  const dependsOnByPhase = new Map<string, string[]>()
  for (const edge of dependencies) {
    const existing = dependsOnByPhase.get(edge.phaseId)
    if (existing) {
      existing.push(edge.dependsOnPhaseId)
    } else {
      dependsOnByPhase.set(edge.phaseId, [edge.dependsOnPhaseId])
    }
  }

  const fullyCompleteCache = new Map<string, boolean>()
  const isPhaseFullyComplete = (phaseId: string): boolean => {
    const cached = fullyCompleteCache.get(phaseId)
    if (cached !== undefined) {
      return cached
    }
    const ownStepsComplete = (stepsByPhase.get(phaseId) ?? []).every(
      (s) => s.status === 'completed',
    )
    const dependsOn = dependsOnByPhase.get(phaseId) ?? []
    const result = ownStepsComplete && dependsOn.every(isPhaseFullyComplete)
    fullyCompleteCache.set(phaseId, result)
    return result
  }

  const unlocked = new Set<string>()
  for (const phase of phases) {
    const dependsOn = dependsOnByPhase.get(phase.id) ?? []
    if (dependsOn.every(isPhaseFullyComplete)) {
      unlocked.add(phase.id)
    }
  }
  return unlocked
}

// A null phaseId is never locked (see the PhaseScopedStep comment above).
export function isStepLocked(step: PhaseScopedStep, unlockedPhaseIds: Set<string>): boolean {
  return step.phaseId !== null && !unlockedPhaseIds.has(step.phaseId)
}

// Would adding an edge "phaseId depends on dependsOnPhaseId" to `existing`
// create a cycle? True for a direct self-reference, or if dependsOnPhaseId
// can already reach phaseId by following existing "depends on" edges — i.e.
// phaseId would already be (transitively) one of dependsOnPhaseId's own
// dependencies, so the new edge would close a loop. Used by the
// dependency-setting endpoint for server-side enforcement, and by the
// editor UI to disable options that would be rejected before round-tripping
// to the server. See ADR-0019.
export function wouldCreateCycle(
  existing: PhaseDependencyEdge[],
  phaseId: string,
  dependsOnPhaseId: string,
): boolean {
  if (phaseId === dependsOnPhaseId) {
    return true
  }

  const dependsOnByPhase = new Map<string, string[]>()
  for (const edge of existing) {
    const list = dependsOnByPhase.get(edge.phaseId)
    if (list) {
      list.push(edge.dependsOnPhaseId)
    } else {
      dependsOnByPhase.set(edge.phaseId, [edge.dependsOnPhaseId])
    }
  }

  const visited = new Set<string>()
  const stack = [dependsOnPhaseId]
  while (stack.length > 0) {
    const current = stack.pop() as string
    if (current === phaseId) {
      return true
    }
    if (visited.has(current)) {
      continue
    }
    visited.add(current)
    for (const next of dependsOnByPhase.get(current) ?? []) {
      stack.push(next)
    }
  }
  return false
}
