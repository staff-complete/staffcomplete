import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '../lib/api'

export interface ActivityEvent {
  type: 'run_started' | 'run_completed' | 'step_completed'
  at: string
  runId: string
  runType: 'onboarding' | 'offboarding'
  employeeName: string
  stepTitle?: string
}

export async function fetchActivity(): Promise<ActivityEvent[]> {
  const { events } = await apiFetch<{ events: ActivityEvent[] }>('/api/activity')
  return events
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
  })
}
