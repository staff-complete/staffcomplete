import { z } from 'zod'

export const createRunSchema = z.object({
  workflowTemplateId: z.string().min(1, 'A checklist template is required'),
  employeeName: z.string().min(2, 'Name must be at least 2 characters'),
  employeeEmail: z.string().email('A valid email is required'),
  employeeRole: z.string().min(1, 'Role is required'),
  // Onboarding start date / offboarding last working day, as YYYY-MM-DD.
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A valid date is required'),
})
export type CreateRunInput = z.infer<typeof createRunSchema>

// Reassigns who's responsible for an in-progress run's manual step (issue:
// reassign after launch). Null clears the assignee back to unassigned —
// same convention as updateStepSchema's assigneeId on the template side.
export const reassignRunStepSchema = z.object({
  assigneeId: z.string().nullable(),
})
export type ReassignRunStepInput = z.infer<typeof reassignRunStepSchema>
