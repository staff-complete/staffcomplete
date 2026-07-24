// Which phases are unlocked to work on, derived from step completion rather
// than stored — same "compute live, don't trust stale state" pattern as
// computeTrialState (ADR-0015) and isTaskOverdue (./task.ts). A phase
// unlocks once every step in every earlier phase (by position) is
// completed; steps within an unlocked phase have no ordering constraint
// against each other. Shared by apps/api (run detail + task completion) and
// apps/web (locked-phase UI) so they can't disagree about what's unlocked.

export interface PhaseOrder {
  id: string
  position: number
}

export interface PhaseScopedStep {
  // null covers steps created before phases existed (backfilled rows, or a
  // stale write during the migration's expand window) — treated as
  // unconstrained rather than blocking every phase after it.
  phaseId: string | null
  status: string
}

export function computeUnlockedPhaseIds(
  phases: PhaseOrder[],
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

  const orderedPhases = [...phases].sort((a, b) => a.position - b.position)
  const unlocked = new Set<string>()
  for (const phase of orderedPhases) {
    unlocked.add(phase.id)
    const phaseSteps = stepsByPhase.get(phase.id) ?? []
    const phaseComplete = phaseSteps.every((s) => s.status === 'completed')
    if (!phaseComplete) {
      break
    }
  }
  return unlocked
}

// A null phaseId is never locked (see the PhaseScopedStep comment above).
export function isStepLocked(step: PhaseScopedStep, unlockedPhaseIds: Set<string>): boolean {
  return step.phaseId !== null && !unlockedPhaseIds.has(step.phaseId)
}
