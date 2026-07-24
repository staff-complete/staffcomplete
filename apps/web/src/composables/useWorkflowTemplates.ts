import { useQuery } from '@tanstack/vue-query'
import type { AutomatedActionKey } from '@staffcomplete/shared'

export type WorkflowType = 'onboarding' | 'offboarding'
export type StepType = 'automated' | 'manual'

export interface WorkflowTemplateSummary {
  id: string
  name: string
  type: WorkflowType
  stepCount: number
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplateStep {
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

// Steps within a phase can be worked on in parallel; phases themselves run
// in order — a phase only unlocks once every step in the previous phase is
// completed (see packages/shared/src/phase.ts).
export interface WorkflowTemplatePhase {
  id: string
  name: string
  position: number
  steps: WorkflowTemplateStep[]
}

export interface WorkflowTemplateDetail {
  id: string
  name: string
  type: WorkflowType
  createdAt: string
  updatedAt: string
  phases: WorkflowTemplatePhase[]
}

export async function fetchWorkflowTemplates(): Promise<WorkflowTemplateSummary[]> {
  const res = await fetch('/api/workflows')
  if (!res.ok) {
    throw new Error('Failed to load workflow templates')
  }
  const data = (await res.json()) as { workflows: WorkflowTemplateSummary[] }
  return data.workflows
}

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['workflow-templates'],
    queryFn: fetchWorkflowTemplates,
  })
}

export async function fetchWorkflowTemplate(id: string): Promise<WorkflowTemplateDetail | null> {
  const res = await fetch(`/api/workflows/${id}`)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error('Failed to load workflow template')
  }
  return (await res.json()) as WorkflowTemplateDetail
}

export function useWorkflowTemplate(id: string) {
  return useQuery({
    queryKey: ['workflow-template', id],
    queryFn: () => fetchWorkflowTemplate(id),
  })
}
