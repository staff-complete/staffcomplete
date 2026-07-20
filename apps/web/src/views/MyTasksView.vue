<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { completeTask, useMyTasks } from '../composables/useMyTasks'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

const queryClient = useQueryClient()
const { data: tasks, isLoading } = useMyTasks()
const openTasks = computed(() => tasks.value?.filter((t) => t.status === 'pending') ?? [])

const completingId = ref<string | null>(null)
const errorMessage = ref('')

async function markComplete(id: string) {
  errorMessage.value = ''
  completingId.value = id
  try {
    await completeTask(id)
    await queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
  } catch {
    errorMessage.value = 'Unable to complete this task. Please try again.'
  } finally {
    completingId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">My tasks</h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink to="/dashboard" class="text-sm text-brand-teal font-medium hover:underline"
            >← Back to dashboard</RouterLink
          >
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">Open tasks</h2>

        <p v-if="errorMessage" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {{ errorMessage }}
        </p>

        <p v-if="isLoading" class="text-sm text-gray-500">Loading…</p>
        <p v-else-if="openTasks.length === 0" class="text-sm text-gray-500">
          No open tasks assigned to you.
        </p>
        <ul v-else class="divide-y divide-brand-border">
          <li v-for="task in openTasks" :key="task.id" class="py-3 flex items-center gap-4">
            <div class="flex-1">
              <p class="text-sm font-medium text-brand-dark">{{ task.title }}</p>
              <p class="text-xs text-gray-500 capitalize">
                {{ task.run.employeeName }} · {{ task.run.type }}
                <template v-if="task.dueDate">· due {{ task.dueDate }}</template>
              </p>
              <p v-if="task.isOverdue" class="text-xs font-semibold text-red-500 mt-1">Overdue</p>
            </div>
            <button
              type="button"
              :disabled="completingId === task.id"
              class="shrink-0 bg-brand-teal text-white py-2 px-4 rounded-lg text-sm font-semibold transition-opacity"
              :class="
                completingId === task.id ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
              "
              @click="markComplete(task.id)"
            >
              {{ completingId === task.id ? 'Completing…' : 'Mark complete' }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
