import { useQuery } from '@tanstack/vue-query'

export interface MyTask {
  id: string
  title: string
  status: string
  dueDate: string | null
  isOverdue: boolean
  // True while an earlier phase of this run still has incomplete steps —
  // see packages/shared/src/phase.ts. The complete endpoint also enforces
  // this server-side, so the UI only needs to reflect it, not gate on it.
  isLocked: boolean
  run: {
    id: string
    type: 'onboarding' | 'offboarding'
    employeeName: string
    eventDate: string
  }
}

export async function fetchMyTasks(): Promise<MyTask[]> {
  const res = await fetch('/api/tasks/mine')
  if (!res.ok) {
    throw new Error('Failed to load tasks')
  }
  const data = (await res.json()) as { tasks: MyTask[] }
  return data.tasks
}

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: fetchMyTasks,
  })
}

export async function completeTask(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/tasks/${id}/complete`, { method: 'POST' })
    if (!res.ok) {
      throw new Error('Failed to complete task')
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to complete task')
  }
}
