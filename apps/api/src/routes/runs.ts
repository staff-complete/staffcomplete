import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  computeDueDate,
  computeUnlockedPhaseIds,
  createRunSchema,
  isStepLocked,
  isTaskOverdue,
} from '@staffcomplete/shared'
import { withTenant } from '../db/index.js'
import {
  run,
  runPhase,
  runStep,
  workflowTemplate,
  workflowTemplatePhase,
  workflowTemplateStep,
} from '../db/schema.js'
import { requireAdmin } from '../lib/session.js'
import { blockMutationsWhenExpired } from '../middleware/trial-lock.js'

export const runsRouter = new Hono()

runsRouter.get('/', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  // No explicit organizationId filter on either query below: RLS
  // (run_tenant_isolation / run_step_tenant_isolation) already scopes both
  // to session.organizationId via withTenant's set_config.
  const { runs, steps } = await withTenant(session.organizationId, async (tx) => ({
    runs: await tx.query.run.findMany({
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    }),
    steps: await tx.query.runStep.findMany({
      columns: { runId: true, status: true, title: true, dueDateOffsetDays: true, position: true },
    }),
  }))

  const stepsByRun = new Map<string, typeof steps>()
  for (const step of steps) {
    const existing = stepsByRun.get(step.runId)
    if (existing) {
      existing.push(step)
    } else {
      stepsByRun.set(step.runId, [step])
    }
  }

  return c.json({
    runs: runs.map((r) => {
      const runSteps = stepsByRun.get(r.id) ?? []
      const completedStepCount = runSteps.filter((s) => s.status === 'completed').length
      // Health is derived, not stored — a run is "blocked" iff it has at
      // least one currently-overdue step, computed the same way as the
      // detail endpoint below (computeDueDate + isTaskOverdue), so the two
      // endpoints can't disagree about what's overdue.
      const overdueSteps = runSteps
        .filter((s) => isTaskOverdue(computeDueDate(r.eventDate, s.dueDateOffsetDays), s.status))
        .sort((a, b) => a.position - b.position)

      return {
        id: r.id,
        type: r.type,
        employeeName: r.employeeName,
        employeeEmail: r.employeeEmail,
        employeeRole: r.employeeRole,
        eventDate: r.eventDate,
        status: r.status,
        stepCount: runSteps.length,
        completedStepCount,
        overdueStepCount: overdueSteps.length,
        overdueStepTitle: overdueSteps[0]?.title ?? null,
        createdAt: r.createdAt.toISOString(),
      }
    }),
  })
})

runsRouter.get('/:id', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const runId = c.req.param('id')

  // RLS (run_tenant_isolation / run_step_tenant_isolation) scopes both
  // lookups to session.organizationId — a run from another tenant simply
  // won't be found, same as the list endpoint above.
  const result = await withTenant(session.organizationId, async (tx) => {
    const foundRun = await tx.query.run.findFirst({ where: eq(run.id, runId) })
    if (!foundRun) {
      return null
    }
    const phases = await tx.query.runPhase.findMany({
      where: eq(runPhase.runId, runId),
      orderBy: [asc(runPhase.position)],
    })
    const steps = await tx.query.runStep.findMany({
      where: eq(runStep.runId, runId),
      orderBy: [asc(runStep.position)],
    })
    return { foundRun, phases, steps }
  })

  if (!result) {
    return c.json({ code: 'NOT_FOUND', message: 'Run not found.' }, 404)
  }

  const { foundRun, phases, steps } = result
  // Phase gating: steps in a phase can be completed in any order (parallel),
  // but a phase only becomes actionable once every step in every earlier
  // phase is done — see packages/shared/src/phase.ts.
  const unlockedPhaseIds = computeUnlockedPhaseIds(phases, steps)

  return c.json({
    id: foundRun.id,
    type: foundRun.type,
    employeeName: foundRun.employeeName,
    employeeEmail: foundRun.employeeEmail,
    employeeRole: foundRun.employeeRole,
    eventDate: foundRun.eventDate,
    status: foundRun.status,
    createdAt: foundRun.createdAt.toISOString(),
    phases: phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      position: phase.position,
      isLocked: !unlockedPhaseIds.has(phase.id),
    })),
    steps: steps.map((step) => {
      const dueDate = computeDueDate(foundRun.eventDate, step.dueDateOffsetDays)
      return {
        id: step.id,
        phaseId: step.phaseId,
        title: step.title,
        type: step.type,
        assigneeId: step.assigneeId,
        status: step.status,
        dueDate,
        isOverdue: isTaskOverdue(dueDate, step.status),
        isLocked: isStepLocked(step, unlockedPhaseIds),
        position: step.position,
      }
    }),
  })
})

runsRouter.post(
  '/',
  zValidator('json', createRunSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const { workflowTemplateId, employeeName, employeeEmail, employeeRole, eventDate } =
      c.req.valid('json')

    const result = await withTenant(session.organizationId, async (tx) => {
      const template = await tx.query.workflowTemplate.findFirst({
        where: eq(workflowTemplate.id, workflowTemplateId),
      })
      if (!template) {
        return null
      }

      const templatePhases = await tx.query.workflowTemplatePhase.findMany({
        where: eq(workflowTemplatePhase.workflowTemplateId, workflowTemplateId),
        orderBy: [asc(workflowTemplatePhase.position)],
      })
      const templateSteps = await tx.query.workflowTemplateStep.findMany({
        where: eq(workflowTemplateStep.workflowTemplateId, workflowTemplateId),
        orderBy: [asc(workflowTemplateStep.position)],
      })

      const [createdRun] = await tx
        .insert(run)
        .values({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          workflowTemplateId,
          type: template.type,
          employeeName,
          employeeEmail,
          employeeRole,
          eventDate,
        })
        .returning()

      // Copy the template's phases first so runStep.phaseId can point at the
      // run's own copies — a run keeps its own history even if the template
      // is edited or deleted later, same reasoning as runStep vs.
      // workflowTemplateStep (see the comment on `run` in schema.ts).
      const createdPhases = templatePhases.length
        ? await tx
            .insert(runPhase)
            .values(
              templatePhases.map((phase) => ({
                id: crypto.randomUUID(),
                runId: createdRun.id,
                organizationId: session.organizationId,
                name: phase.name,
                position: phase.position,
              })),
            )
            .returning()
        : []
      const runPhaseIdByTemplatePhaseId = new Map(
        templatePhases.map((phase, index) => [phase.id, createdPhases[index]?.id]),
      )

      const createdSteps = templateSteps.length
        ? await tx
            .insert(runStep)
            .values(
              templateSteps.map((step) => ({
                id: crypto.randomUUID(),
                runId: createdRun.id,
                phaseId: step.phaseId
                  ? (runPhaseIdByTemplatePhaseId.get(step.phaseId) ?? null)
                  : null,
                organizationId: session.organizationId,
                title: step.title,
                type: step.type,
                assigneeId: step.assigneeId,
                dueDateOffsetDays: step.dueDateOffsetDays,
                position: step.position,
              })),
            )
            .returning()
        : []

      return { createdRun, createdSteps }
    })

    if (!result) {
      return c.json({ code: 'NOT_FOUND', message: 'Checklist template not found.' }, 404)
    }

    const { createdRun, createdSteps } = result

    return c.json(
      {
        id: createdRun.id,
        type: createdRun.type,
        employeeName: createdRun.employeeName,
        employeeEmail: createdRun.employeeEmail,
        employeeRole: createdRun.employeeRole,
        eventDate: createdRun.eventDate,
        status: createdRun.status,
        createdAt: createdRun.createdAt.toISOString(),
        steps: createdSteps
          .sort((a, b) => a.position - b.position)
          .map((step) => ({
            id: step.id,
            phaseId: step.phaseId,
            title: step.title,
            type: step.type,
            assigneeId: step.assigneeId,
            dueDateOffsetDays: step.dueDateOffsetDays,
            position: step.position,
          })),
      },
      201,
    )
  },
)
