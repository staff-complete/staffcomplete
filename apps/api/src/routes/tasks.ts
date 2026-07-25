import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  computeDueDate,
  computeUnlockedPhaseIds,
  isStepLocked,
  isTaskOverdue,
} from '@staffcomplete/shared'
import { db, withTenant } from '../db/index.js'
import { member, run, runPhase, runPhaseDependency, runStep } from '../db/schema.js'
import { completeRunStep, dispatchAutomatedSteps } from '../lib/run-steps.js'
import { resolveOrgSession } from '../lib/session.js'
import { blockMutationsWhenExpired } from '../middleware/trial-lock.js'

export const tasksRouter = new Hono()

// runStep.assigneeId stores member.id, not user.id — same lookup requireAdmin
// does internally, but without the role check (issue #26 tasks aren't admin-only).
async function resolveMemberId(userId: string, organizationId: string): Promise<string | null> {
  const membership = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    columns: { id: true },
  })
  return membership?.id ?? null
}

function serializeTask(
  step: typeof runStep.$inferSelect,
  parentRun: typeof run.$inferSelect,
  isLocked: boolean,
) {
  const dueDate = computeDueDate(parentRun.eventDate, step.dueDateOffsetDays)
  return {
    id: step.id,
    title: step.title,
    status: step.status,
    dueDate,
    isOverdue: isTaskOverdue(dueDate, step.status),
    isLocked,
    run: {
      id: parentRun.id,
      type: parentRun.type,
      employeeName: parentRun.employeeName,
      eventDate: parentRun.eventDate,
    },
  }
}

tasksRouter.get('/mine', async (c) => {
  const session = await resolveOrgSession(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Sign-in required.' }, 403)
  }

  const memberId = await resolveMemberId(session.userId, session.organizationId)
  if (!memberId) {
    return c.json({ tasks: [] })
  }

  const tasks = await withTenant(session.organizationId, async (tx) => {
    const steps = await tx.query.runStep.findMany({
      where: and(eq(runStep.assigneeId, memberId), eq(runStep.type, 'manual')),
    })
    if (steps.length === 0) {
      return []
    }

    const runIds = [...new Set(steps.map((step) => step.runId))]
    const [runs, phases, allSteps] = await Promise.all([
      tx.query.run.findMany({ where: inArray(run.id, runIds) }),
      tx.query.runPhase.findMany({
        where: inArray(runPhase.runId, runIds),
        columns: { id: true, runId: true },
      }),
      // Every step of each run, not just the caller's — locking a phase
      // depends on sibling steps assigned to other people too.
      tx.query.runStep.findMany({
        where: inArray(runStep.runId, runIds),
        columns: { runId: true, phaseId: true, status: true },
      }),
    ])
    const phaseIds = phases.map((p) => p.id)
    const dependencies = phaseIds.length
      ? await tx.query.runPhaseDependency.findMany({
          where: inArray(runPhaseDependency.phaseId, phaseIds),
          columns: { phaseId: true, dependsOnPhaseId: true },
        })
      : []
    const runsById = new Map(runs.map((r) => [r.id, r]))
    const phaseIdsByRun = new Map<string, Set<string>>()
    for (const phase of phases) {
      const existing = phaseIdsByRun.get(phase.runId)
      if (existing) {
        existing.add(phase.id)
      } else {
        phaseIdsByRun.set(phase.runId, new Set([phase.id]))
      }
    }

    const unlockedPhaseIdsByRun = new Map<string, Set<string>>()
    for (const runId of runIds) {
      const runPhaseIds = phaseIdsByRun.get(runId) ?? new Set<string>()
      unlockedPhaseIdsByRun.set(
        runId,
        computeUnlockedPhaseIds(
          phases.filter((p) => p.runId === runId),
          dependencies.filter((d) => runPhaseIds.has(d.phaseId)),
          allSteps.filter((s) => s.runId === runId),
        ),
      )
    }

    return steps.flatMap((step) => {
      const parentRun = runsById.get(step.runId)
      const unlockedPhaseIds = unlockedPhaseIdsByRun.get(step.runId) ?? new Set<string>()
      return parentRun ? [serializeTask(step, parentRun, isStepLocked(step, unlockedPhaseIds))] : []
    })
  })

  return c.json({ tasks })
})

tasksRouter.post('/:id/complete', blockMutationsWhenExpired(), async (c) => {
  const session = await resolveOrgSession(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Sign-in required.' }, 403)
  }

  const memberId = await resolveMemberId(session.userId, session.organizationId)
  if (!memberId) {
    return c.json({ code: 'FORBIDDEN', message: 'Not a member of this organization.' }, 403)
  }

  const stepId = c.req.param('id')

  const result = await withTenant(session.organizationId, async (tx) => {
    const step = await tx.query.runStep.findFirst({ where: eq(runStep.id, stepId) })
    if (!step) {
      return 'NOT_FOUND' as const
    }
    if (step.assigneeId !== memberId) {
      return 'FORBIDDEN' as const
    }

    const [phases, siblingStepsForLockCheck] = await Promise.all([
      tx.query.runPhase.findMany({
        where: eq(runPhase.runId, step.runId),
        columns: { id: true },
      }),
      tx.query.runStep.findMany({
        where: eq(runStep.runId, step.runId),
        columns: { phaseId: true, status: true },
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
    const unlockedPhaseIds = computeUnlockedPhaseIds(phases, dependencies, siblingStepsForLockCheck)
    if (isStepLocked(step, unlockedPhaseIds)) {
      return 'PHASE_LOCKED' as const
    }

    // Marks the step completed, re-derives run.status (same "compute live,
    // don't trust stale state" approach as trial expiry, ADR-0015), and
    // reports whichever automated steps this just unlocked — e.g. this
    // manual step may have been the last one in its phase, unlocking a
    // phase whose first step is automated.
    return completeRunStep(tx, stepId)
  })

  if (result === 'NOT_FOUND') {
    return c.json({ code: 'NOT_FOUND', message: 'Task not found.' }, 404)
  }
  if (result === 'FORBIDDEN') {
    return c.json({ code: 'FORBIDDEN', message: 'This task is not assigned to you.' }, 403)
  }
  if (result === 'PHASE_LOCKED') {
    return c.json(
      { code: 'PHASE_LOCKED', message: 'Earlier steps must be completed before this one.' },
      403,
    )
  }

  // Dispatched after the transaction above has committed, not from inside
  // it — see lib/run-steps.ts.
  await dispatchAutomatedSteps(session.organizationId, result.stepsToDispatch)

  return c.json(serializeTask(result.updatedStep, result.updatedRun, false))
})
