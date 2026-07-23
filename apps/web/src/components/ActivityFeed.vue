<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { useI18n } from 'vue-i18n'
import { useActivity } from '../composables/useActivity'
import type { ActivityEvent } from '../composables/useActivity'

const { t } = useI18n()
const { data: events, isLoading } = useActivity()

function describe(event: ActivityEvent): string {
  const type = event.runType === 'offboarding' ? t('common.offboarding') : t('common.onboarding')
  switch (event.type) {
    case 'run_started':
      return t('activityFeed.runStarted', { type, name: event.employeeName })
    case 'run_completed':
      return t('activityFeed.runCompleted', { type, name: event.employeeName })
    case 'step_completed':
      return t('activityFeed.stepCompleted', { step: event.stepTitle, name: event.employeeName })
  }
}

function relativeTime(at: string): string {
  return t('activityFeed.ago', { time: formatDistanceToNow(new Date(at)) })
}
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
    <h2 class="text-lg font-semibold text-brand-dark mb-4">{{ t('activityFeed.title') }}</h2>

    <p v-if="isLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</p>
    <p v-else-if="!events || events.length === 0" class="text-sm text-gray-500">
      {{ t('activityFeed.empty') }}
    </p>
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
