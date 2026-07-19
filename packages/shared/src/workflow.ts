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

export const createStepSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  type: stepTypeSchema,
  assigneeId: z.string().nullable().optional(),
  // Manual steps only — how many days after run start the step is due.
  dueDateOffsetDays: z.number().int().min(0).nullable().optional(),
})
export type CreateStepInput = z.infer<typeof createStepSchema>

export const updateStepSchema = createStepSchema.partial()
export type UpdateStepInput = z.infer<typeof updateStepSchema>

export const reorderStepsSchema = z.object({
  stepIds: z.array(z.string()).min(1),
})
export type ReorderStepsInput = z.infer<typeof reorderStepsSchema>
