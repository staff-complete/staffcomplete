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
  <div class="rounded-[22px] bg-white p-6">
    <h2 class="mb-4 text-base font-extrabold">{{ t('activityFeed.title') }}</h2>

    <p v-if="isLoading" class="text-sm text-app-muted">{{ t('common.loading') }}</p>
    <p v-else-if="!events || events.length === 0" class="text-sm text-app-muted">
      {{ t('activityFeed.empty') }}
    </p>
    <ul v-else class="flex flex-col gap-4">
      <li v-for="event in events" :key="`${event.runId}-${event.type}-${event.at}`">
        <RouterLink :to="`/runs/${event.runId}`" class="flex gap-2.5 hover:opacity-80">
          <div class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-app-ink" />
          <div class="text-[13.5px] leading-relaxed text-app-slate">
            {{ describe(event) }}
            <span class="text-app-muted">· {{ relativeTime(event.at) }}</span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
