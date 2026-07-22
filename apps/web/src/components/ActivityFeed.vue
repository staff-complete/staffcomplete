<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { useActivity } from '../composables/useActivity'
import type { ActivityEvent } from '../composables/useActivity'

const { data: events, isLoading } = useActivity()

function describe(event: ActivityEvent): string {
  const verb = event.runType === 'offboarding' ? 'Offboarding' : 'Onboarding'
  switch (event.type) {
    case 'run_started':
      return `${verb} started for ${event.employeeName}`
    case 'run_completed':
      return `${verb} completed for ${event.employeeName}`
    case 'step_completed':
      return `${event.stepTitle} completed for ${event.employeeName}`
  }
}

function relativeTime(at: string): string {
  return `${formatDistanceToNow(new Date(at))} ago`
}
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
    <h2 class="text-lg font-semibold text-brand-dark mb-4">Recent activity</h2>

    <p v-if="isLoading" class="text-sm text-gray-500">Loading…</p>
    <p v-else-if="!events || events.length === 0" class="text-sm text-gray-500">No activity yet.</p>
    <ul v-else class="divide-y divide-brand-border">
      <li v-for="event in events" :key="`${event.runId}-${event.type}-${event.at}`" class="py-3">
        <RouterLink :to="`/runs/${event.runType}/${event.runId}`" class="block hover:opacity-80">
          <p class="text-sm text-brand-dark">{{ describe(event) }}</p>
          <p class="text-xs text-gray-500">{{ relativeTime(event.at) }}</p>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
