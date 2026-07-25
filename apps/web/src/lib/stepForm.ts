import type { AutomatedActionKey } from '@staffcomplete/shared'

export type Member = { id: string; user: { name: string; email: string } }

// Manual and automated steps collect genuinely different fields, but share
// one form/one add-step button per phase — see packages/shared/src/workflow.ts.
// emailTo/emailSubject/emailBody are specific to the email.send action; a
// second registered action with different config would need its own fields
// here rather than reusing these (see useActionConfigFields.ts for how
// they're rendered generically from a per-action field list).
export interface StepFormState {
  title: string
  type: 'automated' | 'manual'
  assigneeId: string
  dueDateOffsetDays: string | number
  action: AutomatedActionKey | ''
  emailTo: string
  emailSubject: string
  emailBody: string
}

export function emptyStepForm(): StepFormState {
  return {
    title: '',
    type: 'manual',
    assigneeId: '',
    dueDateOffsetDays: '',
    action: '',
    emailTo: '',
    emailSubject: '',
    emailBody: '',
  }
}
