import { useQuery } from '@tanstack/vue-query'

export interface ActivityEvent {
  type: 'run_started' | 'run_completed' | 'step_completed'
  at: string
  runId: string
  runType: 'onboarding' | 'offboarding'
  employeeName: string
  stepTitle?: string
}

export async function fetchActivity(): Promise<ActivityEvent[]> {
  const res = await fetch('/api/activity')
  if (!res.ok) {
    throw new Error('Failed to load activity')
  }
  const data = (await res.json()) as { events: ActivityEvent[] }
  return data.events
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
  })
}
