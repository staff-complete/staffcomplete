import { and, eq } from 'drizzle-orm'
import { escapeHtml } from '../auth.js'
import { db } from '../db/index.js'
import { member, user } from '../db/schema.js'

// Everything a task notification email needs to say, pulled out of the
// runStep + its parent run by the caller. Kept as a plain input shape rather
// than the Drizzle row types so the builders below stay pure and trivially
// testable — they do no I/O and never touch the database.
export interface TaskEmailInput {
  employeeName: string
  taskTitle: string
  // Already resolved through computeDueDate (packages/shared/src/task.ts) —
  // null for a manual step with no dueDateOffsetDays set.
  dueDate: string | null
}

export interface TaskEmail {
  subject: string
  html: string
}

// Resolves the address a task notification actually goes to. Today that is
// simply the assignee's login address; issue #28 also called for a per-member
// override (a shared ops alias, a personal address), which was deliberately
// deferred — when it lands, it belongs here and nowhere else, so the two job
// handlers keep asking one question: "where does this member read mail?".
//
// Runs on the plain `db` connection (superuser), because callers are the
// cross-tenant scan and a job handler outside any tenant transaction — and
// neither `member` nor `user` carries an RLS policy to scope against anyway.
// That makes the organizationId filter below the *only* tenant boundary on
// this query, not a redundant second one: without it, a step whose assigneeId
// somehow pointed at another organization's member would quietly email that
// member. assertValidAssignee already prevents such a row from being written,
// so this is the check that keeps the guarantee if that ever regresses —
// scoping the lookup rather than trusting the id handed to it.
//
// Returns null rather than throwing when no such member exists in this
// organization — assigneeId is `on delete set null`, but a member removed
// between enqueue and execution leaves a job pointing at nothing. That's an
// expected race, not a fault: the caller drops the notification instead of
// retrying forever.
export async function resolveAssigneeEmail(
  memberId: string,
  organizationId: string,
): Promise<string | null> {
  const row = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)))
  return row[0]?.email ?? null
}

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:5173'
}

// The "mark it done" link from the acceptance criteria. Points at My Tasks
// rather than a one-click tokenized complete endpoint: completing a step is
// a mutation, and an unauthenticated route that performs one would need the
// signed-token + RLS carve-out treatment ADR-0012 gave the invite system.
// Signing in and clicking Done is one extra click for a far smaller surface.
function tasksLink(label: string): string {
  return `<p><a href="${appUrl()}/tasks" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">${label}</a></p>`
}

// employeeName and taskTitle are both user-authored (the run's employee, the
// template step's title), so they're escaped at every interpolation — same
// rule auth.ts's transactional emails follow. dueDate is a machine-formatted
// YYYY-MM-DD from computeDueDate and never user text.
function dueLine(dueDate: string | null): string {
  return dueDate === null ? '' : `<p>Due <strong>${dueDate}</strong>.</p>`
}

export function buildAssignmentEmail(input: TaskEmailInput): TaskEmail {
  const employeeName = escapeHtml(input.employeeName)
  const taskTitle = escapeHtml(input.taskTitle)
  return {
    subject: `New task: ${input.taskTitle}`,
    html: `
          <p>You have a new StaffComplete task for <strong>${employeeName}</strong>.</p>
          <p><strong>${taskTitle}</strong></p>
          ${dueLine(input.dueDate)}
          ${tasksLink('View your tasks')}
        `,
  }
}

export function buildOverdueEmail(input: TaskEmailInput): TaskEmail {
  const employeeName = escapeHtml(input.employeeName)
  const taskTitle = escapeHtml(input.taskTitle)
  return {
    subject: `Overdue task: ${input.taskTitle}`,
    html: `
          <p>A StaffComplete task for <strong>${employeeName}</strong> is past its due date.</p>
          <p><strong>${taskTitle}</strong></p>
          ${dueLine(input.dueDate)}
          ${tasksLink('Complete it now')}
        `,
  }
}
