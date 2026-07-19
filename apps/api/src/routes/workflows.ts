import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createStepSchema,
  createWorkflowTemplateSchema,
  reorderStepsSchema,
  updateStepSchema,
  updateWorkflowTemplateSchema,
} from '@staffcomplete/shared'
import { db, withTenant } from '../db/index.js'
import { member, workflowTemplate, workflowTemplateStep } from '../db/schema.js'
import { requireAdmin } from '../lib/session.js'
import { blockMutationsWhenExpired } from '../middleware/trial-lock.js'

export const workflowsRouter = new Hono()

async function assertValidAssignee(assigneeId: string, organizationId: string): Promise<boolean> {
  const assignee = await db.query.member.findFirst({
    where: eq(member.id, assigneeId),
    columns: { id: true, organizationId: true },
  })
  return !!assignee && assignee.organizationId === organizationId
}

workflowsRouter.get('/', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  // No explicit organizationId filter on either query below: RLS
  // (workflow_template_tenant_isolation / workflow_template_step_tenant_isolation)
  // already scopes both to session.organizationId via withTenant's set_config.
  const { templates, steps } = await withTenant(session.organizationId, async (tx) => ({
    templates: await tx.query.workflowTemplate.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
    steps: await tx.query.workflowTemplateStep.findMany({
      columns: { workflowTemplateId: true },
    }),
  }))

  const stepCounts = new Map<string, number>()
  for (const step of steps) {
    stepCounts.set(step.workflowTemplateId, (stepCounts.get(step.workflowTemplateId) ?? 0) + 1)
  }

  return c.json({
    workflows: templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      stepCount: stepCounts.get(t.id) ?? 0,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  })
})

workflowsRouter.post(
  '/',
  zValidator('json', createWorkflowTemplateSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const { name, type } = c.req.valid('json')

    const [created] = await withTenant(session.organizationId, (tx) =>
      tx
        .insert(workflowTemplate)
        .values({ id: crypto.randomUUID(), organizationId: session.organizationId, name, type })
        .returning(),
    )

    return c.json(
      {
        id: created.id,
        name: created.name,
        type: created.type,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      201,
    )
  },
)

workflowsRouter.get('/:id', async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const id = c.req.param('id')

  const result = await withTenant(session.organizationId, async (tx) => {
    const template = await tx.query.workflowTemplate.findFirst({
      where: eq(workflowTemplate.id, id),
    })
    if (!template) {
      return null
    }
    const steps = await tx.query.workflowTemplateStep.findMany({
      where: eq(workflowTemplateStep.workflowTemplateId, id),
      orderBy: [asc(workflowTemplateStep.position)],
    })
    return { template, steps }
  })

  if (!result) {
    return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
  }

  return c.json({
    id: result.template.id,
    name: result.template.name,
    type: result.template.type,
    createdAt: result.template.createdAt.toISOString(),
    updatedAt: result.template.updatedAt.toISOString(),
    steps: result.steps.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      assigneeId: s.assigneeId,
      dueDateOffsetDays: s.dueDateOffsetDays,
      position: s.position,
    })),
  })
})

workflowsRouter.patch(
  '/:id',
  zValidator('json', updateWorkflowTemplateSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const id = c.req.param('id')
    const updates = c.req.valid('json')

    const updated = await withTenant(session.organizationId, async (tx) => {
      const existing = await tx.query.workflowTemplate.findFirst({
        where: eq(workflowTemplate.id, id),
        columns: { id: true },
      })
      if (!existing) {
        return null
      }
      const [row] = await tx
        .update(workflowTemplate)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(workflowTemplate.id, id))
        .returning()
      return row
    })

    if (!updated) {
      return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
    }

    return c.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  },
)

workflowsRouter.delete('/:id', blockMutationsWhenExpired(), async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const id = c.req.param('id')

  const deleted = await withTenant(session.organizationId, async (tx) => {
    const existing = await tx.query.workflowTemplate.findFirst({
      where: eq(workflowTemplate.id, id),
      columns: { id: true },
    })
    if (!existing) {
      return false
    }
    // Steps cascade via the workflow_template_step FK's ON DELETE CASCADE.
    await tx.delete(workflowTemplate).where(eq(workflowTemplate.id, id))
    return true
  })

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
  }

  return c.json({ status: 'deleted' })
})

workflowsRouter.post(
  '/:id/steps',
  zValidator('json', createStepSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const { title, type, assigneeId, dueDateOffsetDays } = c.req.valid('json')

    if (assigneeId && !(await assertValidAssignee(assigneeId, session.organizationId))) {
      return c.json({ code: 'INVALID_ASSIGNEE', message: 'Assignee is not a team member.' }, 400)
    }

    const created = await withTenant(session.organizationId, async (tx) => {
      const template = await tx.query.workflowTemplate.findFirst({
        where: eq(workflowTemplate.id, workflowTemplateId),
        columns: { id: true },
      })
      if (!template) {
        return null
      }

      const existingSteps = await tx.query.workflowTemplateStep.findMany({
        where: eq(workflowTemplateStep.workflowTemplateId, workflowTemplateId),
        columns: { position: true },
      })
      const nextPosition = existingSteps.reduce((max, s) => Math.max(max, s.position), -1) + 1

      const [row] = await tx
        .insert(workflowTemplateStep)
        .values({
          id: crypto.randomUUID(),
          workflowTemplateId,
          organizationId: session.organizationId,
          title,
          type,
          assigneeId: assigneeId ?? null,
          dueDateOffsetDays: dueDateOffsetDays ?? null,
          position: nextPosition,
        })
        .returning()
      return row
    })

    if (!created) {
      return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
    }

    return c.json(
      {
        id: created.id,
        title: created.title,
        type: created.type,
        assigneeId: created.assigneeId,
        dueDateOffsetDays: created.dueDateOffsetDays,
        position: created.position,
      },
      201,
    )
  },
)

workflowsRouter.patch(
  '/:id/steps/:stepId',
  zValidator('json', updateStepSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const stepId = c.req.param('stepId')
    const updates = c.req.valid('json')

    if (
      updates.assigneeId &&
      !(await assertValidAssignee(updates.assigneeId, session.organizationId))
    ) {
      return c.json({ code: 'INVALID_ASSIGNEE', message: 'Assignee is not a team member.' }, 400)
    }

    const updated = await withTenant(session.organizationId, async (tx) => {
      const existing = await tx.query.workflowTemplateStep.findFirst({
        where: eq(workflowTemplateStep.id, stepId),
        columns: { id: true, workflowTemplateId: true },
      })
      if (!existing || existing.workflowTemplateId !== workflowTemplateId) {
        return null
      }
      const [row] = await tx
        .update(workflowTemplateStep)
        .set(updates)
        .where(eq(workflowTemplateStep.id, stepId))
        .returning()
      return row
    })

    if (!updated) {
      return c.json({ code: 'NOT_FOUND', message: 'Step not found.' }, 404)
    }

    return c.json({
      id: updated.id,
      title: updated.title,
      type: updated.type,
      assigneeId: updated.assigneeId,
      dueDateOffsetDays: updated.dueDateOffsetDays,
      position: updated.position,
    })
  },
)

workflowsRouter.delete('/:id/steps/:stepId', blockMutationsWhenExpired(), async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const workflowTemplateId = c.req.param('id')
  const stepId = c.req.param('stepId')

  const deleted = await withTenant(session.organizationId, async (tx) => {
    const existing = await tx.query.workflowTemplateStep.findFirst({
      where: eq(workflowTemplateStep.id, stepId),
      columns: { id: true, workflowTemplateId: true },
    })
    if (!existing || existing.workflowTemplateId !== workflowTemplateId) {
      return false
    }
    await tx.delete(workflowTemplateStep).where(eq(workflowTemplateStep.id, stepId))
    return true
  })

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Step not found.' }, 404)
  }

  return c.json({ status: 'deleted' })
})

workflowsRouter.put(
  '/:id/steps/order',
  zValidator('json', reorderStepsSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const { stepIds } = c.req.valid('json')

    const result = await withTenant(session.organizationId, async (tx) => {
      const existingSteps = await tx.query.workflowTemplateStep.findMany({
        where: eq(workflowTemplateStep.workflowTemplateId, workflowTemplateId),
        columns: { id: true },
      })
      const existingIds = new Set(existingSteps.map((s) => s.id))
      const requestedIds = new Set(stepIds)
      const sameSet =
        existingIds.size === requestedIds.size &&
        [...existingIds].every((id) => requestedIds.has(id))
      if (!sameSet) {
        return 'MISMATCH' as const
      }

      for (const [index, stepId] of stepIds.entries()) {
        await tx
          .update(workflowTemplateStep)
          .set({ position: index })
          .where(eq(workflowTemplateStep.id, stepId))
      }
      return 'OK' as const
    })

    if (result === 'MISMATCH') {
      return c.json(
        { code: 'VALIDATION_ERROR', message: "stepIds must match the workflow's existing steps." },
        400,
      )
    }

    return c.json({ status: 'reordered' })
  },
)
