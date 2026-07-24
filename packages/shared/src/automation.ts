import { z } from 'zod'

// What an automated step actually does, and what parameters it needs — see
// the discussion on workflow.ts's createStepSchema. Each entry's configSchema
// is deliberately per-action rather than one shared shape, since different
// actions need different parameters (or none at all).
export const emailSendWelcomeConfigSchema = z.strictObject({})
export type EmailSendWelcomeConfig = z.infer<typeof emailSendWelcomeConfigSchema>

export const automatedActionRegistry = {
  'email.send_welcome': {
    label: 'Send welcome email',
    configSchema: emailSendWelcomeConfigSchema,
  },
} as const

export type AutomatedActionKey = keyof typeof automatedActionRegistry

export const automatedActionKeys = Object.keys(automatedActionRegistry) as AutomatedActionKey[]

export const automatedActionKeySchema = z.enum(
  automatedActionKeys as [AutomatedActionKey, ...AutomatedActionKey[]],
)

export function isAutomatedActionKey(value: string): value is AutomatedActionKey {
  return value in automatedActionRegistry
}

// Validates a config payload against its action's own schema. Used wherever
// an automated step's action+config pair needs checking together (step
// create/update) rather than as two independent fields.
export function parseAutomatedActionConfig(action: AutomatedActionKey, config: unknown) {
  return automatedActionRegistry[action].configSchema.safeParse(config ?? {})
}
