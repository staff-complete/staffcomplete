export type RunHealth = 'onTrack' | 'blocked' | 'completed'

// Derived purely from real data (run status + overdue step count from the
// API) — the design this is based on had a richer "waiting" state with a
// fabricated human-readable reason (e.g. "Manager approval overdue"), which
// nothing in our schema can actually produce, so it's collapsed to a
// two-state heuristic here.
export function runHealth(run: { status: string; overdueStepCount: number }): RunHealth {
  if (run.status === 'completed') return 'completed'
  return run.overdueStepCount > 0 ? 'blocked' : 'onTrack'
}
