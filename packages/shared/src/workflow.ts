import { z } from 'zod'
import { automatedActionKeySchema, parseAutomatedActionConfig } from './automation.js'

export const workflowTypeSchema = z.enum(['onboarding', 'offboarding'])
export const stepTypeSchema = z.enum(['automated', 'manual'])

export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  type: workflowTypeSchema,
})
export type CreateWorkflowTemplateInput = z.infer<typeof createWorkflowTemplateSchema>

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema.partial()
export type UpdateWorkflowTemplateInput = z.infer<typeof updateWorkflowTemplateSchema>

export const createPhaseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
})
export type CreatePhaseInput = z.infer<typeof createPhaseSchema>

export const updatePhaseSchema = createPhaseSchema.partial()
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>

export const reorderPhasesSchema = z.object({
  phaseIds: z.array(z.string()).min(1),
})
export type ReorderPhasesInput = z.infer<typeof reorderPhasesSchema>

// Manual and automated steps are different enough in shape that they get
// separate schemas rather than one with every field optional: a manual step
// is a free-text task assigned to a person; an automated step is a specific,
// registered action (packages/shared/src/automation.ts) with its own
// parameters. Neither concept applies to the other — an automated step has
// no assignee, a manual step has no action/config.
const createStepBaseSchema = {
  // Steps within a phase can run in parallel; phases themselves run
  // sequentially — see packages/shared/src/phase.ts.
  phaseId: z.string().min(1, 'A phase is required'),
}

export const createManualStepSchema = z.object({
  ...createStepBaseSchema,
  type: z.literal('manual'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  assigneeId: z.string().nullable().optional(),
  dueDateOffsetDays: z.number().int().min(0).nullable().optional(),
})
export type CreateManualStepInput = z.infer<typeof createManualStepSchema>

export const createAutomatedStepSchema = z.object({
  ...createStepBaseSchema,
  type: z.literal('automated'),
  // Free text like a manual step's title, not derived from the action's
  // registered label — a template can have several steps using the same
  // action (e.g. two "Send email" steps to different recipients), so the
  // label alone can't distinguish them.
  title: z.string().min(2, 'Title must be at least 2 characters'),
  action: automatedActionKeySchema,
  // Validated against the action's own schema in the superRefine below,
  // since what's valid here depends entirely on which action this is.
  config: z.unknown().optional(),
})
export type CreateAutomatedStepInput = z.infer<typeof createAutomatedStepSchema>

export const createStepSchema = z
  .discriminatedUnion('type', [createManualStepSchema, createAutomatedStepSchema])
  .superRefine((data, ctx) => {
    if (data.type !== 'automated') {
      return
    }
    const result = parseAutomatedActionConfig(data.action, data.config)
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['config'],
        message: 'Invalid configuration for this action.',
      })
    }
  })
export type CreateStepInput = z.infer<typeof createStepSchema>

// Flatter than createStepSchema on purpose: a step's `type` is immutable
// once created (delete and recreate to change it — converting a manual
// step's fields into an automated step's makes no sense mid-edit), so an
// update never needs to discriminate on it. phaseId here also moves the
// step to a different phase (it lands at the end of that phase — see
// workflows.ts). Only cross-validates config against action when action is
// actually part of the update, since a bare config-only update can't know
// which action's schema to check against without it.
export const updateStepSchema = z
  .object({
    phaseId: z.string().min(1, 'A phase is required').optional(),
    title: z.string().min(2, 'Title must be at least 2 characters').optional(),
    assigneeId: z.string().nullable().optional(),
    dueDateOffsetDays: z.number().int().min(0).nullable().optional(),
    action: automatedActionKeySchema.optional(),
    config: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === undefined) {
      return
    }
    const result = parseAutomatedActionConfig(data.action, data.config)
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['config'],
        message: 'Invalid configuration for this action.',
      })
    }
  })
export type UpdateStepInput = z.infer<typeof updateStepSchema>

// Reorders steps within a single phase (the route scopes stepIds to
// :phaseId) — order across phases is controlled by reorderPhasesSchema instead.
export const reorderStepsSchema = z.object({
  stepIds: z.array(z.string()).min(1),
})
export type ReorderStepsInput = z.infer<typeof reorderStepsSchema>
