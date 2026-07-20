// Derives a manual runStep's due date from its parent run's eventDate plus
// the step's dueDateOffsetDays, and whether it's overdue. Single source of
// truth shared by apps/api (the tasks routes) and apps/web (the overdue
// badge) so the math can't drift between them — same pattern as
// computeTrialState in ./trial.ts. Deliberately plain Date arithmetic, no
// date-fns, to match trial.ts and avoid adding the dependency to this package.

// eventDate is a YYYY-MM-DD string (as stored on `run`); offsetDays is null
// for automated steps or manual steps with no due date set.
export function computeDueDate(eventDate: string, offsetDays: number | null): string | null {
  if (offsetDays === null) {
    return null
  }
  const date = new Date(`${eventDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

// A completed task is never overdue, regardless of its due date. Reporting
// (this function), not a stored status, is the source of truth — mirrors the
// trial-expiry pattern in ./trial.ts (ADR-0015).
export function isTaskOverdue(
  dueDate: string | null,
  status: string,
  now: Date = new Date(),
): boolean {
  if (status === 'completed' || dueDate === null) {
    return false
  }
  return new Date(`${dueDate}T00:00:00Z`).getTime() < now.getTime()
}
