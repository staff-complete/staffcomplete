import { useQuery } from '@tanstack/vue-query'
import { apiFetchOrNull } from '../lib/api'
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

// A phase unlocks once every phase it explicitly depends on is complete
// (ADR-0019) — steps within a phase can be worked on in parallel, and
// independent branches run at the same time. `position` is display order
// only, not the locking rule (see packages/shared/src/phase.ts).
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
  return apiFetchOrNull<RunDetail>(`/api/runs/${id}`)
}

export function useRunDetail(id: string) {
  return useQuery({
    queryKey: ['runs', id],
    queryFn: () => fetchRunDetail(id),
  })
}
