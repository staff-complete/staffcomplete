import { useQuery } from '@tanstack/vue-query'

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
  title: string
  type: StepType
  assigneeId: string | null
  dueDateOffsetDays: number | null
  position: number
}

export interface WorkflowTemplateDetail {
  id: string
  name: string
  type: WorkflowType
  createdAt: string
  updatedAt: string
  steps: WorkflowTemplateStep[]
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
