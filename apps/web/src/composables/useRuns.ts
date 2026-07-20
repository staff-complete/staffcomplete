import { useQuery } from '@tanstack/vue-query'

export interface RunSummary {
  id: string
  type: 'onboarding' | 'offboarding'
  employeeName: string
  employeeEmail: string
  employeeRole: string
  eventDate: string
  status: string
  stepCount: number
  createdAt: string
}

export async function fetchRuns(): Promise<RunSummary[]> {
  const res = await fetch('/api/runs')
  if (!res.ok) {
    throw new Error('Failed to load runs')
  }
  const data = (await res.json()) as { runs: RunSummary[] }
  return data.runs
}

export function useRuns() {
  return useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
  })
}
