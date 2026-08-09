import { eq } from 'drizzle-orm'
import { computeDueDate } from '@staffcomplete/shared'
import { sendAuthEmail } from '../auth.js'
import { withTenant } from '../db/index.js'
import { run, runStep } from '../db/schema.js'
import { componentLogger } from '../lib/logger.js'
import { buildAssignmentEmail, resolveAssigneeEmail } from '../lib/task-notifications.js'

const log = componentLogger('notify-task-assignment')

export interface NotifyTaskAssignmentPayload {
  runStepId: string
  organizationId: string
}

// Emails the assignee that a manual task is now theirs to do. Same three-part
// shape as execute-automated-step.ts: reads in one short transaction, the
// Resend call outside any transaction (an HTTP call has no business holding a
// Postgres transaction open), then the assignmentNotifiedAt write in a second
// short one.
export async function notifyTaskAssignment(payload: NotifyTaskAssignmentPayload): Promise<void> {
  const { runStepId, organizationId } = payload

  const prepared = await withTenant(organizationId, async (tx) => {
    const step = await tx.query.runStep.findFirst({ where: eq(runStep.id, runStepId) })
    if (!step) {
      log.error({ runStepId }, 'run step not found')
      return null
    }
    // Second-layer idempotency guard, mirroring execute-automated-step.ts:
    // selectManualStepsToNotify already filters these out at enqueue time and
    // singletonKey dedups concurrent enqueues, but a retried job landing after
    // an earlier attempt succeeded would otherwise send twice. A step
    // completed or reassigned since enqueue is likewise no longer worth
    // mailing about.
    if (step.type !== 'manual' || step.status !== 'pending' || step.assignmentNotifiedAt !== null) {
      return null
    }
    if (step.assigneeId === null) {
      return null
    }

    const foundRun = await tx.query.run.findFirst({ where: eq(run.id, step.runId) })
    if (!foundRun) {
      log.error({ runStepId, runId: step.runId }, 'run not found for step')
      return null
    }

    return { assigneeId: step.assigneeId, title: step.title, step, run: foundRun }
  })

  if (!prepared) {
    return
  }

  const to = await resolveAssigneeEmail(prepared.assigneeId, organizationId)
  if (to === null) {
    // The member was removed between enqueue and execution. Nobody to tell,
    // and retrying can't conjure them back — log and drop rather than burning
    // the retry budget. assignmentNotifiedAt stays null on purpose, so
    // handing the step to someone else later still announces it to them.
    log.error({ runStepId, assigneeId: prepared.assigneeId }, 'assignee has no email')
    return
  }

  const { subject, html } = buildAssignmentEmail({
    employeeName: prepared.run.employeeName,
    taskTitle: prepared.title,
    dueDate: computeDueDate(prepared.run.eventDate, prepared.step.dueDateOffsetDays),
  })

  // xss/no-mixed-html reads an `html` variable passed to a function it does
  // not recognize as a browser-XSS sink, and suggests DOMPurify (a DOM
  // sanitizer). There is no DOM here: this is an email body sent through
  // Resend, and buildAssignmentEmail already escapes every user-authored
  // field it interpolates. The rule additionally wants `to` and `subject`
  // encoded — both are plain text, where escaping would corrupt the address
  // and leave visible entities in the subject line.
  // eslint-disable-next-line xss/no-mixed-html
  const result = await sendAuthEmail(to, subject, html)
  if (result.error) {
    // Thrown, not logged-and-returned: a Resend outage or bad API key is the
    // transient-failure path, so the handler rejects and pg-boss retries per
    // the retryLimit set in dispatchTaskNotifications. assignmentNotifiedAt
    // stays null, so the retry re-sends rather than silently skipping.
    throw new Error(`assignment email failed for run step: ${result.error.message}`)
  }

  await withTenant(organizationId, (tx) =>
    tx.update(runStep).set({ assignmentNotifiedAt: new Date() }).where(eq(runStep.id, runStepId)),
  )
}
