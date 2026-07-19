import { z } from 'zod'

export type { Job, JobHandler, Queue } from './queue.js'
export { computeTrialState, TRIAL_LENGTH_DAYS } from './trial.js'
export type { TrialState } from './trial.js'

export const signUpSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid work email required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
