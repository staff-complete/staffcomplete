import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createPhaseSchema,
  createStepSchema,
  createWorkflowTemplateSchema,
  reorderPhasesSchema,
  reorderStepsSchema,
  updatePhaseSchema,
  updateStepSchema,
  updateWorkflowTemplateSchema,
} from '@staffcomplete/shared'
import { db, withTenant } from '../db/index.js'
import {
  member,
  workflowTemplate,
  workflowTemplatePhase,
  workflowTemplateStep,
} from '../db/schema.js'
import { requireAdmin } from '../lib/session.js'
import { blockMutationsWhenExpired } from '../middleware/trial-lock.js'

export const workflowsRouter = new Hono()

function serializePhase(phase: typeof workflowTemplatePhase.$inferSelect) {
  return { id: phase.id, name: phase.name, position: phase.position }
}

function serializeStep(step: typeof workflowTemplateStep.$inferSelect) {
  return {
    id: step.id,
    phaseId: step.phaseId,
    title: step.title,
    type: step.type,
    assigneeId: step.assigneeId,
    dueDateOffsetDays: step.dueDateOffsetDays,
    action: step.action,
    config: step.config,
    position: step.position,
  }
}

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
    const phases = await tx.query.workflowTemplatePhase.findMany({
      where: eq(workflowTemplatePhase.workflowTemplateId, id),
      orderBy: [asc(workflowTemplatePhase.position)],
    })
    const steps = await tx.query.workflowTemplateStep.findMany({
      where: eq(workflowTemplateStep.workflowTemplateId, id),
      orderBy: [asc(workflowTemplateStep.position)],
    })
    return { template, phases, steps }
  })

  if (!result) {
    return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
  }

  const stepsByPhase = new Map<string, (typeof result.steps)[number][]>()
  for (const step of result.steps) {
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

  return c.json({
    id: result.template.id,
    name: result.template.name,
    type: result.template.type,
    createdAt: result.template.createdAt.toISOString(),
    updatedAt: result.template.updatedAt.toISOString(),
    phases: result.phases.map((phase) => ({
      ...serializePhase(phase),
      steps: (stepsByPhase.get(phase.id) ?? []).map(serializeStep),
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
  '/:id/phases',
  zValidator('json', createPhaseSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const { name } = c.req.valid('json')

    const created = await withTenant(session.organizationId, async (tx) => {
      const template = await tx.query.workflowTemplate.findFirst({
        where: eq(workflowTemplate.id, workflowTemplateId),
        columns: { id: true },
      })
      if (!template) {
        return null
      }

      const existingPhases = await tx.query.workflowTemplatePhase.findMany({
        where: eq(workflowTemplatePhase.workflowTemplateId, workflowTemplateId),
        columns: { position: true },
      })
      const nextPosition = existingPhases.reduce((max, p) => Math.max(max, p.position), -1) + 1

      const [row] = await tx
        .insert(workflowTemplatePhase)
        .values({
          id: crypto.randomUUID(),
          workflowTemplateId,
          organizationId: session.organizationId,
          name,
          position: nextPosition,
        })
        .returning()
      return row
    })

    if (!created) {
      return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
    }

    return c.json(serializePhase(created), 201)
  },
)

workflowsRouter.patch(
  '/:id/phases/:phaseId',
  zValidator('json', updatePhaseSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const phaseId = c.req.param('phaseId')
    const updates = c.req.valid('json')

    const updated = await withTenant(session.organizationId, async (tx) => {
      const existing = await tx.query.workflowTemplatePhase.findFirst({
        where: eq(workflowTemplatePhase.id, phaseId),
        columns: { id: true, workflowTemplateId: true },
      })
      if (!existing || existing.workflowTemplateId !== workflowTemplateId) {
        return null
      }
      const [row] = await tx
        .update(workflowTemplatePhase)
        .set(updates)
        .where(eq(workflowTemplatePhase.id, phaseId))
        .returning()
      return row
    })

    if (!updated) {
      return c.json({ code: 'NOT_FOUND', message: 'Phase not found.' }, 404)
    }

    return c.json(serializePhase(updated))
  },
)

workflowsRouter.delete('/:id/phases/:phaseId', blockMutationsWhenExpired(), async (c) => {
  const session = await requireAdmin(c)
  if (!session) {
    return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
  }

  const workflowTemplateId = c.req.param('id')
  const phaseId = c.req.param('phaseId')

  const deleted = await withTenant(session.organizationId, async (tx) => {
    const existing = await tx.query.workflowTemplatePhase.findFirst({
      where: eq(workflowTemplatePhase.id, phaseId),
      columns: { id: true, workflowTemplateId: true },
    })
    if (!existing || existing.workflowTemplateId !== workflowTemplateId) {
      return false
    }
    // Steps cascade via the workflow_template_step FK's ON DELETE CASCADE.
    await tx.delete(workflowTemplatePhase).where(eq(workflowTemplatePhase.id, phaseId))
    return true
  })

  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Phase not found.' }, 404)
  }

  return c.json({ status: 'deleted' })
})

// Named /phase-order rather than the more consistent /phases/order:
// alongside /phases/:phaseId/steps/order, a literal "order" segment and a
// :phaseId param both sitting at the same depth under the same PUT method
// is a route shape Hono's RegExpRouter can't compile — it throws
// UnsupportedPathError building the matcher, which makes SmartRouter fall
// back to TrieRouter for the whole app, and TrieRouter doesn't resolve the
// /api/auth/** wildcard mount the same way (broke sign-in/sign-up entirely).
workflowsRouter.put(
  '/:id/phase-order',
  zValidator('json', reorderPhasesSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const { phaseIds } = c.req.valid('json')

    const result = await withTenant(session.organizationId, async (tx) => {
      const existingPhases = await tx.query.workflowTemplatePhase.findMany({
        where: eq(workflowTemplatePhase.workflowTemplateId, workflowTemplateId),
        columns: { id: true },
      })
      const existingIds = new Set(existingPhases.map((p) => p.id))
      const requestedIds = new Set(phaseIds)
      const sameSet =
        existingIds.size === requestedIds.size &&
        [...existingIds].every((id) => requestedIds.has(id))
      if (!sameSet) {
        return 'MISMATCH' as const
      }

      for (const [index, phaseId] of phaseIds.entries()) {
        await tx
          .update(workflowTemplatePhase)
          .set({ position: index })
          .where(eq(workflowTemplatePhase.id, phaseId))
      }
      return 'OK' as const
    })

    if (result === 'MISMATCH') {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: "phaseIds must match the workflow's existing phases.",
        },
        400,
      )
    }

    return c.json({ status: 'reordered' })
  },
)

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
    const body = c.req.valid('json')
    const { phaseId } = body

    if (
      body.type === 'manual' &&
      body.assigneeId &&
      !(await assertValidAssignee(body.assigneeId, session.organizationId))
    ) {
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

      const phase = await tx.query.workflowTemplatePhase.findFirst({
        where: eq(workflowTemplatePhase.id, phaseId),
        columns: { id: true, workflowTemplateId: true },
      })
      if (!phase || phase.workflowTemplateId !== workflowTemplateId) {
        return 'INVALID_PHASE' as const
      }

      const existingSteps = await tx.query.workflowTemplateStep.findMany({
        where: eq(workflowTemplateStep.phaseId, phaseId),
        columns: { position: true },
      })
      const nextPosition = existingSteps.reduce((max, s) => Math.max(max, s.position), -1) + 1

      // Manual and automated steps store genuinely different things beyond
      // title: a manual step is free-text + who's doing it; an automated
      // step is a registered action + its own parameters — see
      // packages/shared/src/automation.ts. Both kinds keep their own
      // user-given title, since a template can have several automated steps
      // sharing one action (e.g. two "Send email" steps to different
      // recipients) that need distinguishing.
      const kindValues =
        body.type === 'manual'
          ? {
              assigneeId: body.assigneeId ?? null,
              dueDateOffsetDays: body.dueDateOffsetDays ?? null,
              action: null,
              config: null,
            }
          : {
              assigneeId: null,
              dueDateOffsetDays: null,
              action: body.action,
              config: body.config ?? {},
            }

      const [row] = await tx
        .insert(workflowTemplateStep)
        .values({
          id: crypto.randomUUID(),
          workflowTemplateId,
          phaseId,
          organizationId: session.organizationId,
          type: body.type,
          title: body.title,
          ...kindValues,
          position: nextPosition,
        })
        .returning()
      return row
    })

    if (created === 'INVALID_PHASE') {
      return c.json(
        { code: 'INVALID_PHASE', message: 'Phase does not belong to this workflow.' },
        400,
      )
    }
    if (!created) {
      return c.json({ code: 'NOT_FOUND', message: 'Workflow not found.' }, 404)
    }

    return c.json(serializeStep(created), 201)
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
        columns: { id: true, workflowTemplateId: true, phaseId: true, type: true },
      })
      if (!existing || existing.workflowTemplateId !== workflowTemplateId) {
        return null
      }

      // A step's type is immutable (delete and recreate to change it — see
      // createStepSchema), so a manual-only or automated-only field showing
      // up for the other kind means the client mixed up which step this is.
      if (updates.action !== undefined && existing.type !== 'automated') {
        return 'TYPE_MISMATCH' as const
      }
      if (
        (updates.assigneeId !== undefined || updates.dueDateOffsetDays !== undefined) &&
        existing.type !== 'manual'
      ) {
        return 'TYPE_MISMATCH' as const
      }

      // Moving to a different phase: validate it belongs to this workflow
      // and drop the step at the end of the destination phase, same as a
      // freshly created step — position is meaningless across phases.
      let position: number | undefined
      if (updates.phaseId && updates.phaseId !== existing.phaseId) {
        const phase = await tx.query.workflowTemplatePhase.findFirst({
          where: eq(workflowTemplatePhase.id, updates.phaseId),
          columns: { id: true, workflowTemplateId: true },
        })
        if (!phase || phase.workflowTemplateId !== workflowTemplateId) {
          return 'INVALID_PHASE' as const
        }
        const destinationSteps = await tx.query.workflowTemplateStep.findMany({
          where: eq(workflowTemplateStep.phaseId, updates.phaseId),
          columns: { position: true },
        })
        position = destinationSteps.reduce((max, s) => Math.max(max, s.position), -1) + 1
      }

      const [row] = await tx
        .update(workflowTemplateStep)
        .set(position === undefined ? updates : { ...updates, position })
        .where(eq(workflowTemplateStep.id, stepId))
        .returning()
      return row
    })

    if (updated === 'TYPE_MISMATCH') {
      return c.json(
        {
          code: 'TYPE_MISMATCH',
          message: "This field doesn't apply to the step's type.",
        },
        400,
      )
    }
    if (updated === 'INVALID_PHASE') {
      return c.json(
        { code: 'INVALID_PHASE', message: 'Phase does not belong to this workflow.' },
        400,
      )
    }
    if (!updated) {
      return c.json({ code: 'NOT_FOUND', message: 'Step not found.' }, 404)
    }

    return c.json(serializeStep(updated))
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
  '/:id/phases/:phaseId/steps/order',
  zValidator('json', reorderStepsSchema),
  blockMutationsWhenExpired(),
  async (c) => {
    const session = await requireAdmin(c)
    if (!session) {
      return c.json({ code: 'FORBIDDEN', message: 'Admin access required.' }, 403)
    }

    const workflowTemplateId = c.req.param('id')
    const phaseId = c.req.param('phaseId')
    const { stepIds } = c.req.valid('json')

    const result = await withTenant(session.organizationId, async (tx) => {
      const existingSteps = await tx.query.workflowTemplateStep.findMany({
        where: and(
          eq(workflowTemplateStep.workflowTemplateId, workflowTemplateId),
          eq(workflowTemplateStep.phaseId, phaseId),
        ),
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
