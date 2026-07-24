import { useQuery } from '@tanstack/vue-query'
import type { AutomatedActionKey } from '@staffcomplete/shared'

export interface RunStepDetail {
  id: string
  phaseId: string | null
  title: string
  type: 'automated' | 'manual'
  // Manual steps only.
  assigneeId: string | null
  // Automated steps only — see packages/shared/src/automation.ts.
  action: AutomatedActionKey | null
  config: unknown
  status: string
  dueDate: string | null
  isOverdue: boolean
  isLocked: boolean
  position: number
}

// A phase unlocks once every step in every earlier phase (by position) is
// completed — steps within a phase can be worked on in parallel, phases
// themselves run in order (see packages/shared/src/phase.ts).
export interface RunPhaseDetail {
  id: string
  name: string
  position: number
  isLocked: boolean
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
  phases: RunPhaseDetail[]
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
