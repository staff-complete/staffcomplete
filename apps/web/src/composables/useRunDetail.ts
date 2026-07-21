import { useQuery } from '@tanstack/vue-query'

export interface RunStepDetail {
  id: string
  title: string
  type: 'automated' | 'manual'
  assigneeId: string | null
  status: string
  dueDate: string | null
  isOverdue: boolean
  position: number
}

export interface RunDetail {
  id: string
  type: 'onboarding' | 'offboarding'
  employeeName: string
  employeeEmail: string
  employeeRole: string
  eventDate: string
  status: string
  createdAt: string
  steps: RunStepDetail[]
}

export async function fetchRunDetail(id: string): Promise<RunDetail | null> {
  const res = await fetch(`/api/runs/${id}`)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error('Failed to load run')
  }
  return (await res.json()) as RunDetail
}

export function useRunDetail(id: string) {
  return useQuery({
    queryKey: ['runs', id],
    queryFn: () => fetchRunDetail(id),
  })
}
