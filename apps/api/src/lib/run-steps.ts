import { eq, inArray } from 'drizzle-orm'
import { computeUnlockedPhaseIds, isStepLocked } from '@staffcomplete/shared'
import type { PhaseDependencyEdge } from '@staffcomplete/shared'
import type { Tx } from '../db/index.js'
import { run, runPhase, runPhaseDependency, runStep } from '../db/schema.js'
import { queue } from '../queue/index.js'

// Queue name shared between dispatchAutomatedSteps (enqueue) and the job
// handler that processes it (apps/api/src/jobs/execute-automated-step.ts).
export const AUTOMATED_STEP_EXECUTE_JOB = 'automated-step-execute'

export interface DispatchableStep {
  id: string
  phaseId: string
  type: string
  status: string
}

// Pure: which of `steps` are automated, still pending, and sitting in a
// phase that's actually unlocked right now. Reusable against either
// freshly-queried rows or steps already held in memory (e.g. right after
// run creation, where the created rows are already on hand).
export function selectStepsToDispatch(
  phases: Array<{ id: string }>,
  dependencies: PhaseDependencyEdge[],
  steps: DispatchableStep[],
): DispatchableStep[] {
  const unlockedPhaseIds = computeUnlockedPhaseIds(phases, dependencies, steps)
  return steps.filter(
    (step) =>
      step.type === 'automated' &&
      step.status === 'pending' &&
      !isStepLocked({ phaseId: step.phaseId, status: step.status }, unlockedPhaseIds),
  )
}

// Enqueues one execution job per step. Call only after the transaction that
// produced/unlocked `steps` has committed — enqueuing from inside that same
// transaction risks queuing a job for a write that could still roll back.
// singletonKey dedups on the step id, so two racing completions that both
// see the same newly-unlocked phase can't double-enqueue (and therefore
// can't double-send) the same step.
export async function dispatchAutomatedSteps(
  organizationId: string,
  steps: Array<{ id: string }>,
): Promise<void> {
  await Promise.all(
    steps.map((step) =>
      queue.enqueue(
        { name: AUTOMATED_STEP_EXECUTE_JOB, data: { runStepId: step.id, organizationId } },
        { singletonKey: step.id, retryLimit: 5, retryBackoff: true },
      ),
    ),
  )
}

// Marks a step completed, re-derives run.status the same way tasks.ts's
// /complete handler already did, and returns whichever automated steps just
// became dispatchable as a result (the phase this step was in may now be
// fully complete, unlocking the next one). Does not enqueue anything itself
// — callers dispatch the returned steps after their own transaction commits.
export async function completeRunStep(
  tx: Tx,
  stepId: string,
): Promise<{
  updatedStep: typeof runStep.$inferSelect
  updatedRun: typeof run.$inferSelect
  stepsToDispatch: DispatchableStep[]
}> {
  const [updatedStep] = await tx
    .update(runStep)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(runStep.id, stepId))
    .returning()

  const siblingSteps = await tx.query.runStep.findMany({
    where: eq(runStep.runId, updatedStep.runId),
    columns: { id: true, phaseId: true, type: true, status: true },
  })
  const allCompleted = siblingSteps.every((s) => s.status === 'completed')
  const [updatedRun] = await tx
    .update(run)
    .set({ status: allCompleted ? 'completed' : 'in_progress', updatedAt: new Date() })
    .where(eq(run.id, updatedStep.runId))
    .returning()

  const phases = await tx.query.runPhase.findMany({
    where: eq(runPhase.runId, updatedStep.runId),
    columns: { id: true },
  })
  const dependencies = phases.length
    ? await tx.query.runPhaseDependency.findMany({
        where: inArray(
          runPhaseDependency.phaseId,
          phases.map((p) => p.id),
        ),
        columns: { phaseId: true, dependsOnPhaseId: true },
      })
    : []
  const stepsToDispatch = selectStepsToDispatch(phases, dependencies, siblingSteps)

  return { updatedStep, updatedRun, stepsToDispatch }
}
