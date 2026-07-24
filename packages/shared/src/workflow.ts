import { z } from 'zod'

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

export const createStepSchema = z.object({
  // Steps within a phase can run in parallel; phases themselves run
  // sequentially — see packages/shared/src/phase.ts.
  phaseId: z.string().min(1, 'A phase is required'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  type: stepTypeSchema,
  assigneeId: z.string().nullable().optional(),
  // Manual steps only — how many days after run start the step is due.
  dueDateOffsetDays: z.number().int().min(0).nullable().optional(),
})
export type CreateStepInput = z.infer<typeof createStepSchema>

// Partial of createStepSchema, so passing phaseId here also moves the step
// to a different phase (it lands at the end of that phase — see workflows.ts).
export const updateStepSchema = createStepSchema.partial()
export type UpdateStepInput = z.infer<typeof updateStepSchema>

// Reorders steps within a single phase (the route scopes stepIds to
// :phaseId) — order across phases is controlled by reorderPhasesSchema instead.
export const reorderStepsSchema = z.object({
  stepIds: z.array(z.string()).min(1),
})
export type ReorderStepsInput = z.infer<typeof reorderStepsSchema>
