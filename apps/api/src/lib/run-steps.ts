import { eq, inArray } from 'drizzle-orm'
import { computeUnlockedPhaseIds, isStepLocked } from '@staffcomplete/shared'
import type { PhaseDependencyEdge } from '@staffcomplete/shared'
import type { Tx } from '../db/index.js'
import { run, runPhase, runPhaseDependency, runStep } from '../db/schema.js'
import { queue } from '../queue/index.js'

// Queue name shared between dispatchAutomatedSteps (enqueue) and the job
// handler that processes it (apps/api/src/jobs/execute-automated-step.ts).
export const AUTOMATED_STEP_EXECUTE_JOB = 'automated-step-execute'

// Queue name shared between dispatchTaskNotifications (enqueue) and
// apps/api/src/jobs/notify-task-assignment.ts. A separate queue from
// AUTOMATED_STEP_EXECUTE_JOB, so the two can safely share a singletonKey
// (the run-step id) without colliding — pg-boss scopes singletonKey per
// queue.
export const TASK_ASSIGNMENT_NOTIFY_JOB = 'task-assignment-notify'

export interface DispatchableStep {
  id: string
  phaseId: string
  type: string
  status: string
}

export interface NotifiableStep extends DispatchableStep {
  assigneeId: string | null
  assignmentNotifiedAt: Date | null
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

// The manual counterpart to selectStepsToDispatch: which of `steps` are
// manual tasks that just became someone's problem — assigned, still pending,
// in an unlocked phase, and not emailed about before.
//
// Notifying on unlock rather than at run creation is deliberate. A step in a
// locked phase can't be completed (isStepLocked gates the UI), so mailing its
// assignee about it would be an alert they can't act on — and on a run
// started weeks before the event date, one they'd have forgotten by the time
// it opened. This mirrors exactly when an automated step gets dispatched.
//
// assignmentNotifiedAt is checked here rather than left to the job handler so
// a step already emailed about is never even enqueued; the handler re-checks
// it anyway, since two cascades can race between this call and the send.
export function selectManualStepsToNotify(
  phases: Array<{ id: string }>,
  dependencies: PhaseDependencyEdge[],
  steps: NotifiableStep[],
): NotifiableStep[] {
  const unlockedPhaseIds = computeUnlockedPhaseIds(phases, dependencies, steps)
  return steps.filter(
    (step) =>
      step.type === 'manual' &&
      step.status === 'pending' &&
      step.assigneeId !== null &&
      step.assignmentNotifiedAt === null &&
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

// selectManualStepsToNotify against a run loaded fresh from the database,
// for callers that changed one step and don't already hold the run's phase
// graph in memory (reassignment in routes/runs.ts). Run creation and
// completeRunStep call the pure selector directly with rows they already
// have, rather than paying for these queries again.
export async function loadNotifiableTasks(tx: Tx, runId: string): Promise<NotifiableStep[]> {
  const [phases, steps] = await Promise.all([
    tx.query.runPhase.findMany({ where: eq(runPhase.runId, runId), columns: { id: true } }),
    tx.query.runStep.findMany({
      where: eq(runStep.runId, runId),
      columns: {
        id: true,
        phaseId: true,
        type: true,
        status: true,
        assigneeId: true,
        assignmentNotifiedAt: true,
      },
    }),
  ])
  const dependencies = phases.length
    ? await tx.query.runPhaseDependency.findMany({
        where: inArray(
          runPhaseDependency.phaseId,
          phases.map((p) => p.id),
        ),
        columns: { phaseId: true, dependsOnPhaseId: true },
      })
    : []
  return selectManualStepsToNotify(phases, dependencies, steps)
}

// Enqueues one assignment-email job per newly-actionable manual task. Same
// post-commit rule as dispatchAutomatedSteps above, and for the same reason:
// enqueuing inside the transaction that unlocked these steps risks emailing
// someone about a task a rollback then erases.
export async function dispatchTaskNotifications(
  organizationId: string,
  steps: Array<{ id: string }>,
): Promise<void> {
  await Promise.all(
    steps.map((step) =>
      queue.enqueue(
        { name: TASK_ASSIGNMENT_NOTIFY_JOB, data: { runStepId: step.id, organizationId } },
        { singletonKey: step.id, retryLimit: 5, retryBackoff: true },
      ),
    ),
  )
}

// Marks a step completed, re-derives run.status the same way tasks.ts's
// /complete handler already did, and returns what just became actionable as
// a result (the phase this step was in may now be fully complete, unlocking
// the next one): automated steps to dispatch, and manual tasks whose
// assignee should now be emailed. Does not enqueue anything itself —
// callers dispatch both lists after their own transaction commits.
export async function completeRunStep(
  tx: Tx,
  stepId: string,
): Promise<{
  updatedStep: typeof runStep.$inferSelect
  updatedRun: typeof run.$inferSelect
  stepsToDispatch: DispatchableStep[]
  tasksToNotify: NotifiableStep[]
}> {
  const [updatedStep] = await tx
    .update(runStep)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(runStep.id, stepId))
    .returning()

  const siblingSteps = await tx.query.runStep.findMany({
    where: eq(runStep.runId, updatedStep.runId),
    columns: {
      id: true,
      phaseId: true,
      type: true,
      status: true,
      assigneeId: true,
      assignmentNotifiedAt: true,
    },
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
  const tasksToNotify = selectManualStepsToNotify(phases, dependencies, siblingSteps)

  return { updatedStep, updatedRun, stepsToDispatch, tasksToNotify }
}
