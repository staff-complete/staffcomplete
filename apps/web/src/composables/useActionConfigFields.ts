import type { AutomatedActionKey } from '@staffcomplete/shared'

// Renders the "Action configuration" fields for an automated step from a
// small per-action metadata list instead of hand-coding a block per action —
// see ADR-0018's note that a schema-driven form is future work once there's
// a second real action. This list stays web-layer-only (not derived from
// packages/shared/src/automation.ts's Zod schemas) and today covers exactly
// the same 3 email.send fields the editor already had, just via one loop.
export interface ActionConfigField {
  key: 'emailTo' | 'emailSubject' | 'emailBody'
  labelKey: string
  placeholderKey?: string
  hintKey?: string
  type: 'text' | 'textarea'
}

export const actionConfigFields: Record<AutomatedActionKey, ActionConfigField[]> = {
  'email.send': [
    {
      key: 'emailTo',
      labelKey: 'workflows.editor.emailToLabel',
      placeholderKey: 'workflows.editor.emailToPlaceholder',
      type: 'text',
    },
    { key: 'emailSubject', labelKey: 'workflows.editor.emailSubjectLabel', type: 'text' },
    {
      key: 'emailBody',
      labelKey: 'workflows.editor.emailBodyLabel',
      placeholderKey: 'workflows.editor.emailBodyPlaceholder',
      hintKey: 'workflows.editor.emailBodyHint',
      type: 'textarea',
    },
  ],
}
