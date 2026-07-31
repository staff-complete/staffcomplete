import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '../lib/api'

export interface MyTask {
  id: string
  title: string
  status: string
  dueDate: string | null
  isOverdue: boolean
  // True while a phase this step's phase depends on still has incomplete
  // steps (ADR-0019) — see packages/shared/src/phase.ts. The complete
  // endpoint also enforces this server-side, so the UI only needs to
  // reflect it, not gate on it.
  isLocked: boolean
  run: {
    id: string
    type: 'onboarding' | 'offboarding'
    employeeName: string
    eventDate: string
  }
}

export async function fetchMyTasks(): Promise<MyTask[]> {
  const { tasks } = await apiFetch<{ tasks: MyTask[] }>('/api/tasks/mine')
  return tasks
}

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: fetchMyTasks,
  })
}

export async function completeTask(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}/complete`, { method: 'POST' })
}
