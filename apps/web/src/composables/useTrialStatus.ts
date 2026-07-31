import { useQuery } from '@tanstack/vue-query'
import { apiFetchOrNull } from '../lib/api'

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
  // 404 means no subscription row yet — not an error state for the banner.
  return apiFetchOrNull<TrialStatus>('/api/billing/trial-status')
}

export function useTrialStatus() {
  return useQuery({
    queryKey: ['trial-status'],
    queryFn: fetchTrialStatus,
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}
