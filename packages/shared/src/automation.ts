import { z } from 'zod'

// What an automated step actually does, and what parameters it needs — see
// the discussion on workflow.ts's createStepSchema. Each entry's configSchema
// is deliberately per-action rather than one shared shape, since different
// actions need different parameters (or none at all).
//
// to/subject/body are the actual email content, filled in per-step when the
// action is added to a template — there's no baked-in copy, since this is a
// general-purpose "send an email" action (welcome the new hire, notify IT,
// remind a manager — whoever), not specifically a welcome email. to/body may
// reference [employeeName], [employeeEmail], [employeeRole], and [eventDate]
// (the run fields of the same name) — square brackets rather than
// {{mustache}} so the token syntax doesn't collide with vue-i18n's own
// {named} interpolation wherever this gets surfaced as UI hint text.
// Substituting them (and actually sending anything) is the job of whatever
// eventually executes this action, not this schema.
export const emailSendConfigSchema = z.strictObject({
  to: z.string().min(1, 'Recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})
export type EmailSendConfig = z.infer<typeof emailSendConfigSchema>

export type AutomatedActionKey = 'email.send'

interface AutomatedActionDefinition {
  // English fallback for contexts that can't reach vue-i18n (server-side
  // step title default, activity feed, non-UI logging) — the UI itself
  // should prefer t(`workflows.automatedActions.${key}`) instead of this,
  // same as any other UI vocabulary (see apps/web's locale files). Unlike a
  // manual step's title, this label isn't user-authored content, so it gets
  // translated like other chrome rather than stored as free text.
  label: string
  configSchema: z.ZodType
}

// A Map, not a plain lookup object — looking up a key from validated input
// (still just a string at the type-checker's boundary) is exactly what
// static analysis flags as a generic object injection sink on a plain
// object; Map.get isn't a property access, so it doesn't trip that check.
const automatedActionEntries: ReadonlyArray<[AutomatedActionKey, AutomatedActionDefinition]> = [
  ['email.send', { label: 'Send email', configSchema: emailSendConfigSchema }],
]

const automatedActionRegistry = new Map<AutomatedActionKey, AutomatedActionDefinition>(
  automatedActionEntries,
)

export const automatedActionKeys: AutomatedActionKey[] = automatedActionEntries.map(([key]) => key)

export const automatedActionKeySchema = z.enum(
  automatedActionKeys as [AutomatedActionKey, ...AutomatedActionKey[]],
)

export function isAutomatedActionKey(value: string): value is AutomatedActionKey {
  return automatedActionRegistry.has(value as AutomatedActionKey)
}

// Throws rather than returning undefined: every caller already has an
// AutomatedActionKey (validated by automatedActionKeySchema at the API
// boundary), so a missing entry here means the registry and the key type
// have drifted apart — a bug to surface loudly, not a normal "not found".
export function getAutomatedAction(key: AutomatedActionKey): AutomatedActionDefinition {
  const entry = automatedActionRegistry.get(key)
  if (!entry) {
    throw new Error(`No automated action registered for key: ${key}`)
  }
  return entry
}

// Validates a config payload against its action's own schema. Used wherever
// an automated step's action+config pair needs checking together (step
// create/update) rather than as two independent fields.
export function parseAutomatedActionConfig(action: AutomatedActionKey, config: unknown) {
  return getAutomatedAction(action).configSchema.safeParse(config ?? {})
}
