import { useQuery } from '@tanstack/vue-query'
import { apiFetch, apiFetchOrNull } from '../lib/api'
import type { AutomatedActionKey } from '@staffcomplete/shared'

export type ChecklistType = 'onboarding' | 'offboarding'
export type StepType = 'automated' | 'manual'

export interface ChecklistTemplateSummary {
  id: string
  name: string
  type: ChecklistType
  phaseCount: number
  stepCount: number
  createdAt: string
  updatedAt: string
}

export interface ChecklistTemplateStep {
  id: string
  phaseId: string
  title: string
  type: StepType
  // Manual steps only.
  assigneeId: string | null
  dueDateOffsetDays: number | null
  // Automated steps only — see packages/shared/src/automation.ts.
  action: AutomatedActionKey | null
  config: unknown
  position: number
}

// Steps within a phase can be worked on in parallel; a phase only unlocks
// once every phase in dependsOnPhaseIds is fully complete (ADR-0019).
// `position` is display order only — it no longer implies a dependency.
// An empty dependsOnPhaseIds means this phase is a root, unlocked
// immediately (see packages/shared/src/phase.ts).
export interface ChecklistTemplatePhase {
  id: string
  name: string
  position: number
  dependsOnPhaseIds: string[]
  steps: ChecklistTemplateStep[]
}

export interface ChecklistTemplateDetail {
  id: string
  name: string
  type: ChecklistType
  createdAt: string
  updatedAt: string
  phases: ChecklistTemplatePhase[]
}

export async function fetchChecklistTemplates(): Promise<ChecklistTemplateSummary[]> {
  const { checklists } = await apiFetch<{ checklists: ChecklistTemplateSummary[] }>(
    '/api/checklists',
  )
  return checklists
}

export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['checklist-templates'],
    queryFn: fetchChecklistTemplates,
  })
}

export async function fetchChecklistTemplate(id: string): Promise<ChecklistTemplateDetail | null> {
  return apiFetchOrNull<ChecklistTemplateDetail>(`/api/checklists/${id}`)
}

export function useChecklistTemplate(id: string) {
  return useQuery({
    queryKey: ['checklist-template', id],
    queryFn: () => fetchChecklistTemplate(id),
  })
}
