import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  computeDueDate,
  computeUnlockedPhaseIds,
  isStepLocked,
  isTaskOverdue,
} from '@staffcomplete/shared'
import { db, withTenant } from '../db/index.js'
import { member, run, runPhase, runStep } from '../db/schema.js'
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
        columns: { id: true, runId: true, position: true },
      }),
      // Every step of each run, not just the caller's — locking a phase
      // depends on sibling steps assigned to other people too.
      tx.query.runStep.findMany({
        where: inArray(runStep.runId, runIds),
        columns: { runId: true, phaseId: true, status: true },
      }),
    ])
    const runsById = new Map(runs.map((r) => [r.id, r]))

    const unlockedPhaseIdsByRun = new Map<string, Set<string>>()
    for (const runId of runIds) {
      unlockedPhaseIdsByRun.set(
        runId,
        computeUnlockedPhaseIds(
          phases.filter((p) => p.runId === runId),
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
        columns: { id: true, position: true },
      }),
      tx.query.runStep.findMany({
        where: eq(runStep.runId, step.runId),
        columns: { phaseId: true, status: true },
      }),
    ])
    const unlockedPhaseIds = computeUnlockedPhaseIds(phases, siblingStepsForLockCheck)
    if (isStepLocked(step, unlockedPhaseIds)) {
      return 'PHASE_LOCKED' as const
    }

    const [updatedStep] = await tx
      .update(runStep)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(runStep.id, stepId))
      .returning()

    // Re-derive run.status from its steps rather than trusting a separately
    // tracked counter, same "compute live, don't trust stale state" approach
    // as trial expiry (ADR-0015) — see packages/shared/src/task.ts.
    const siblingSteps = await tx.query.runStep.findMany({
      where: eq(runStep.runId, step.runId),
      columns: { status: true },
    })
    const allCompleted = siblingSteps.every((s) => s.status === 'completed')
    const [updatedRun] = await tx
      .update(run)
      .set({ status: allCompleted ? 'completed' : 'in_progress', updatedAt: new Date() })
      .where(eq(run.id, step.runId))
      .returning()

    return { updatedStep, updatedRun }
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

  return c.json(serializeTask(result.updatedStep, result.updatedRun, false))
})
