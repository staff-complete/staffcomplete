import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '../lib/api'

export interface RunSummary {
  id: string
  type: 'onboarding' | 'offboarding'
  employeeName: string
  employeeEmail: string
  employeeRole: string
  eventDate: string
  status: string
  stepCount: number
  completedStepCount: number
  overdueStepCount: number
  overdueStepTitle: string | null
  createdAt: string
}

export async function fetchRuns(): Promise<RunSummary[]> {
  const { runs } = await apiFetch<{ runs: RunSummary[] }>('/api/runs')
  return runs
}

export function useRuns() {
  return useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
  })
}
