import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { computeDueDate, createRunSchema, isTaskOverdue } from '@staffcomplete/shared'
import { withTenant } from '../db/index.js'
import { run, runStep, workflowTemplate, workflowTemplateStep } from '../db/schema.js'
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
      columns: { runId: true, status: true },
    }),
  }))

  const stepCounts = new Map<string, number>()
  const completedStepCounts = new Map<string, number>()
  for (const step of steps) {
    stepCounts.set(step.runId, (stepCounts.get(step.runId) ?? 0) + 1)
    if (step.status === 'completed') {
      completedStepCounts.set(step.runId, (completedStepCounts.get(step.runId) ?? 0) + 1)
    }
  }

  return c.json({
    runs: runs.map((r) => ({
      id: r.id,
      type: r.type,
      employeeName: r.employeeName,
      employeeEmail: r.employeeEmail,
      employeeRole: r.employeeRole,
      eventDate: r.eventDate,
      status: r.status,
      stepCount: stepCounts.get(r.id) ?? 0,
      completedStepCount: completedStepCounts.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
    })),
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
    const steps = await tx.query.runStep.findMany({
      where: eq(runStep.runId, runId),
      orderBy: [asc(runStep.position)],
    })
    return { foundRun, steps }
  })

  if (!result) {
    return c.json({ code: 'NOT_FOUND', message: 'Run not found.' }, 404)
  }

  const { foundRun, steps } = result

  return c.json({
    id: foundRun.id,
    type: foundRun.type,
    employeeName: foundRun.employeeName,
    employeeEmail: foundRun.employeeEmail,
    employeeRole: foundRun.employeeRole,
    eventDate: foundRun.eventDate,
    status: foundRun.status,
    createdAt: foundRun.createdAt.toISOString(),
    steps: steps.map((step) => {
      const dueDate = computeDueDate(foundRun.eventDate, step.dueDateOffsetDays)
      return {
        id: step.id,
        title: step.title,
        type: step.type,
        assigneeId: step.assigneeId,
        status: step.status,
        dueDate,
        isOverdue: isTaskOverdue(dueDate, step.status),
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

      const createdSteps = templateSteps.length
        ? await tx
            .insert(runStep)
            .values(
              templateSteps.map((step) => ({
                id: crypto.randomUUID(),
                runId: createdRun.id,
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
