import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  computeDueDate,
  computeUnlockedPhaseIds,
  createRunSchema,
  isStepLocked,
  isTaskOverdue,
  reassignRunStepSchema,
} from '@staffcomplete/shared'
import { withTenant } from '../db/index.js'
import {
  run,
  runPhase,
  runPhaseDependency,
  runStep,
  workflowTemplate,
  workflowTemplatePhase,
  workflowTemplatePhaseDependency,
  workflowTemplateStep,
} from '../db/schema.js'
import { assertValidAssignee } from '../lib/assignee.js'
import { dispatchAutomatedSteps, selectStepsToDispatch } from '../lib/run-steps.js'
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
    const dependencies = phases.length
      ? await tx.query.runPhaseDependency.findMany({
          where: inArray(
            runPhaseDependency.phaseId,
            phases.map((p) => p.id),
          ),
        })
      : []
    const steps = await tx.query.runStep.findMany({
      where: eq(runStep.runId, runId),
      orderBy: [asc(runStep.position)],
    })
    return { foundRun, phases, dependencies, steps }
  })

  if (!result) {
    return c.json({ code: 'NOT_FOUND', message: 'Run not found.' }, 404)
  }

  const { foundRun, phases, dependencies, steps } = result
  // Phase gating: steps in a phase can be completed in any order (parallel),
  // but a phase only becomes actionable once every phase it explicitly
  // depends on is done — see packages/shared/src/phase.ts (ADR-0019).
  const unlockedPhaseIds = computeUnlockedPhaseIds(phases, dependencies, steps)

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
        action: step.action,
        config: step.config,
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
      const templateDependencies = templatePhases.length
        ? await tx.query.workflowTemplatePhaseDependency.findMany({
            where: inArray(
              workflowTemplatePhaseDependency.phaseId,
              templatePhases.map((p) => p.id),
            ),
          })
        : []
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
      // workflowTemplateStep (see the comment on `run` in schema.ts). Each
      // copy's id is generated here, up front, so both the insert values and
      // the template->run phase-id map can read it directly without a
      // .returning() round trip or a re-lookup by array index/key.
      const phaseCopies = templatePhases.map((phase) => ({
        templatePhaseId: phase.id,
        runPhaseId: crypto.randomUUID(),
        name: phase.name,
        position: phase.position,
      }))
      const runPhaseIdByTemplatePhaseId = new Map(
        phaseCopies.map((copy) => [copy.templatePhaseId, copy.runPhaseId]),
      )
      if (phaseCopies.length) {
        await tx.insert(runPhase).values(
          phaseCopies.map((copy) => ({
            id: copy.runPhaseId,
            runId: createdRun.id,
            organizationId: session.organizationId,
            name: copy.name,
            position: copy.position,
          })),
        )
      }

      // Copy the template's dependency edges onto the run's own phase
      // copies (ADR-0019), same "run keeps its own history" reasoning as
      // the phase/step copies above. Dangling-reference handling mirrors
      // the runStep loop below — the FK on workflowTemplatePhaseDependency
      // should make an edge outside this template's phases impossible.
      const dependencyCopies = templateDependencies.map((edge) => {
        const runPhaseId = runPhaseIdByTemplatePhaseId.get(edge.phaseId)
        const dependsOnRunPhaseId = runPhaseIdByTemplatePhaseId.get(edge.dependsOnPhaseId)
        if (runPhaseId === undefined || dependsOnRunPhaseId === undefined) {
          throw new Error(
            `workflowTemplatePhaseDependency ${edge.id} references a phase outside workflowTemplate ${workflowTemplateId}`,
          )
        }
        return { phaseId: runPhaseId, dependsOnPhaseId: dependsOnRunPhaseId }
      })
      if (dependencyCopies.length) {
        await tx.insert(runPhaseDependency).values(
          dependencyCopies.map((copy) => ({
            id: crypto.randomUUID(),
            phaseId: copy.phaseId,
            dependsOnPhaseId: copy.dependsOnPhaseId,
            organizationId: session.organizationId,
          })),
        )
      }

      const createdSteps = templateSteps.length
        ? await tx
            .insert(runStep)
            .values(
              templateSteps.map((step) => {
                const stepRunPhaseId = runPhaseIdByTemplatePhaseId.get(step.phaseId)
                if (stepRunPhaseId === undefined) {
                  // Would mean workflowTemplateStep.phaseId's FK points at a
                  // phase outside phaseCopies, i.e. outside this same
                  // template — the FK constraint should make that
                  // impossible, so surface it loudly rather than writing a
                  // runStep with a dangling phase reference.
                  throw new Error(
                    `workflowTemplateStep ${step.id} references phase ${step.phaseId}, which is not part of workflowTemplate ${workflowTemplateId}`,
                  )
                }
                return {
                  id: crypto.randomUUID(),
                  runId: createdRun.id,
                  phaseId: stepRunPhaseId,
                  organizationId: session.organizationId,
                  title: step.title,
                  type: step.type,
                  assigneeId: step.assigneeId,
                  dueDateOffsetDays: step.dueDateOffsetDays,
                  action: step.action,
                  config: step.config,
                  position: step.position,
                }
              }),
            )
            .returning()
        : []

      return {
        createdRun,
        createdSteps,
        createdPhases: phaseCopies.map((copy) => ({
          id: copy.runPhaseId,
          position: copy.position,
        })),
        createdDependencies: dependencyCopies,
      }
    })

    if (!result) {
      return c.json({ code: 'NOT_FOUND', message: 'Checklist template not found.' }, 404)
    }

    const { createdRun, createdSteps, createdPhases, createdDependencies } = result

    // Only root phases (no dependencies) are ever unlocked on a brand-new
    // run (zero steps completed anywhere yet) — dispatch their automated
    // steps now that the creating transaction has committed. See
    // lib/run-steps.ts for why dispatch happens post-commit rather than
    // inside the transaction above.
    await dispatchAutomatedSteps(
      session.organizationId,
      selectStepsToDispatch(createdPhases, createdDependencies, createdSteps),
    )

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
            action: step.action,
            config: step.config,
            position: step.position,
          })),
      },
      201,
    )
  },
)

// Reassigns who's responsible for a manual step on an already-started run.
// Mirrors workflowsRouter's PATCH .../steps/:stepId (template-step editing)
// but scoped to what a run actually needs: only assigneeId can change here —
// a run's steps are a frozen copy of the template (see the `run` comment in
// schema.ts), so title/phase/action/config are fixed once the run starts.
runsRouter.patch(
  '/:id/steps/:stepId',
  zValidator('json', reassignRunStepSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const runId = c.req.param('id')
    const stepId = c.req.param('stepId')
    const { assigneeId } = c.req.valid('json')

    if (assigneeId && !(await assertValidAssignee(assigneeId, session.organizationId))) {
      return c.json({ code: 'INVALID_ASSIGNEE', message: 'Assignee is not a team member.' }, 400)
    }

    const updated = await withTenant(session.organizationId, async (tx) => {
      const existing = await tx.query.runStep.findFirst({
        where: eq(runStep.id, stepId),
        columns: { id: true, runId: true, type: true, status: true },
      })
      if (!existing || existing.runId !== runId) {
        return null
      }
      if (existing.type !== 'manual') {
        return 'TYPE_MISMATCH' as const
      }
      if (existing.status === 'completed') {
        return 'STEP_COMPLETED' as const
      }

      const [row] = await tx
        .update(runStep)
        .set({ assigneeId })
        .where(eq(runStep.id, stepId))
        .returning()
      return row
    })

    if (updated === 'TYPE_MISMATCH') {
      return c.json({ code: 'TYPE_MISMATCH', message: 'Only manual steps can be reassigned.' }, 400)
    }
    if (updated === 'STEP_COMPLETED') {
      return c.json({ code: 'STEP_COMPLETED', message: 'This step is already completed.' }, 400)
    }
    if (!updated) {
      return c.json({ code: 'NOT_FOUND', message: 'Step not found.' }, 404)
    }

    return c.json({ id: updated.id, assigneeId: updated.assigneeId })
  },
)
