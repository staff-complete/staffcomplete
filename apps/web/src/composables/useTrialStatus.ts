import { useQuery } from '@tanstack/vue-query'

export interface TrialStatus {
  status: string
  trialEndsAt: string
  daysRemaining: number
  isReadOnly: boolean
}

const REFETCH_INTERVAL_MS = 60_000

// Separated from useTrialStatus so it's testable as a plain async function —
// this repo has no jsdom/component-mounting test setup (see router/guards.ts
// for the same dependency-injection-over-DOM-mounting pattern).
export async function fetchTrialStatus(): Promise<TrialStatus | null> {
  const res = await fetch('/api/billing/trial-status')
  if (res.status === 404) {
    // No subscription row yet — not an error state for the banner to show.
    return null
  }
  if (!res.ok) {
    throw new Error('Failed to load trial status')
  }
  return (await res.json()) as TrialStatus
}

export function useTrialStatus() {
  return useQuery({
    queryKey: ['trial-status'],
    queryFn: fetchTrialStatus,
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}
