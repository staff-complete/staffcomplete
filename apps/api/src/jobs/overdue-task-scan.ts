import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { computeDueDate, isTaskOverdue } from '@staffcomplete/shared'
import { sendAuthEmail } from '../auth.js'
import { db } from '../db/index.js'
import { run, runStep } from '../db/schema.js'
import { componentLogger } from '../lib/logger.js'
import { buildOverdueEmail, resolveAssigneeEmail } from '../lib/task-notifications.js'

const log = componentLogger('overdue-task-scan')

// Cross-tenant by design, same category as trial-lifecycle-scan.ts: this is a
// system sweep over every organization's open tasks, not a request scoped to
// one tenant, so it queries the plain `db` connection (superuser) rather than
// withTenant/tenantDb. See ADR-0012 for the carve-out.
export async function runOverdueTaskScan(): Promise<void> {
  let candidates: Array<{
    id: string
    title: string
    assigneeId: string | null
    organizationId: string
    dueDateOffsetDays: number | null
    employeeName: string
    eventDate: string
  }>
  try {
    candidates = await db
      .select({
        id: runStep.id,
        title: runStep.title,
        assigneeId: runStep.assigneeId,
        organizationId: runStep.organizationId,
        dueDateOffsetDays: runStep.dueDateOffsetDays,
        employeeName: run.employeeName,
        eventDate: run.eventDate,
      })
      .from(runStep)
      .innerJoin(run, eq(run.id, runStep.runId))
      .where(
        and(
          eq(runStep.type, 'manual'),
          eq(runStep.status, 'pending'),
          isNotNull(runStep.assigneeId),
          isNotNull(runStep.dueDateOffsetDays),
          // Only remind about tasks the assignee has already been told about.
          // That is what makes this safe without recomputing every run's phase
          // graph here: the assignment email only goes out once a step's phase
          // is unlocked, and a phase never re-locks (steps only move
          // pending -> completed), so assignmentNotifiedAt being set is proof
          // the task is actionable. Nagging someone about a task still blocked
          // behind an earlier phase would be an alert they cannot act on.
          isNotNull(runStep.assignmentNotifiedAt),
          isNull(runStep.overdueNotifiedAt),
        ),
      )
  } catch (err) {
    log.error({ err }, 'failed to fetch overdue task candidates')
    return
  }

  // The due date is derived (run.eventDate + the step's offset, per
  // computeDueDate) rather than stored, so it can't be filtered in SQL —
  // the WHERE above narrows to open, already-announced, not-yet-reminded
  // tasks and the actual overdue test happens here.
  for (const candidate of candidates) {
    const dueDate = computeDueDate(candidate.eventDate, candidate.dueDateOffsetDays)
    if (!isTaskOverdue(dueDate, 'pending')) {
      continue
    }
    try {
      await remindAssignee(candidate, dueDate)
    } catch (err) {
      // One task's failure (a removed member, an email provider hiccup) must
      // not stop the rest of the scan — same containment as the per-org loop
      // in trial-lifecycle-scan.ts.
      log.error({ err, runStepId: candidate.id }, 'overdue reminder failed')
    }
  }
}

async function remindAssignee(
  candidate: {
    id: string
    title: string
    assigneeId: string | null
    organizationId: string
    employeeName: string
  },
  dueDate: string | null,
): Promise<void> {
  if (candidate.assigneeId === null) {
    return
  }
  // Scoped to the step's own organization — this sweep is cross-tenant, so
  // the recipient lookup must not be.
  const to = await resolveAssigneeEmail(candidate.assigneeId, candidate.organizationId)
  if (to === null) {
    log.error(
      { runStepId: candidate.id, assigneeId: candidate.assigneeId },
      'assignee has no email',
    )
    return
  }

  const { subject, html } = buildOverdueEmail({
    employeeName: candidate.employeeName,
    taskTitle: candidate.title,
    dueDate,
  })
  const result = await sendAuthEmail(to, subject, html)
  if (result.error) {
    throw new Error(`overdue email failed for run step: ${result.error.message}`)
  }

  // Marked immediately after this task's send succeeds, before moving to the
  // next, so a mid-scan crash or a second run the same day can't double-send
  // — the same ordering trial-lifecycle-scan.ts uses for trialReminderSentAt.
  // One reminder per task, not a daily nag.
  await db
    .update(runStep)
    .set({ overdueNotifiedAt: new Date() })
    .where(eq(runStep.id, candidate.id))
}
