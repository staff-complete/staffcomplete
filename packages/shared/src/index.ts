import { z } from 'zod'

/**
 * Longest values we accept. 254 is the maximum length of an email address;
 * the company cap is arbitrary but keeps a paste accident out of the inbox.
 */
const MAX_EMAIL_LENGTH = 254
const MAX_COMPANY_LENGTH = 100

/**
 * A request to be let into the early-access programme. Shared by the landing
 * form and the Pages Function that turns it into a notification email — there
 * is no database behind it.
 */
export const earlyAccessRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .max(MAX_EMAIL_LENGTH, 'Email is too long')
    .email('Valid work email required'),
  // The notification email renders this as a labelled line of plain text, so a
  // control character could forge a line and misrepresent who asked for access.
  company: z
    .string()
    .trim()
    .max(MAX_COMPANY_LENGTH, 'Company name is too long')
    .regex(/^[^\p{Cc}]*$/u, 'Company name cannot contain line breaks')
    .optional(),
})

export type EarlyAccessRequest = z.infer<typeof earlyAccessRequestSchema>
