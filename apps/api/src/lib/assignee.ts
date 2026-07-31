import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { member } from '../db/schema.js'

// Shared between checklists.ts (template-step assignee) and runs.ts (run-step
// reassignment) — an assignee must be a member of the same tenant as the
// step being assigned.
export async function assertValidAssignee(
  assigneeId: string,
  organizationId: string,
): Promise<boolean> {
  const assignee = await db.query.member.findFirst({
    where: eq(member.id, assigneeId),
    columns: { id: true, organizationId: true },
  })
  return !!assignee && assignee.organizationId === organizationId
}
