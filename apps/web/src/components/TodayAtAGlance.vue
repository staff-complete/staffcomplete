<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMyTasks } from '../composables/useMyTasks'
import { useRuns } from '../composables/useRuns'

const { t } = useI18n()
const { data: tasks } = useMyTasks()
const { data: runs } = useRuns()

const openTaskCount = computed(
  () => tasks.value?.filter((task) => task.status === 'pending').length ?? 0,
)
const overdueStepCount = computed(
  () => runs.value?.reduce((sum, run) => sum + run.overdueStepCount, 0) ?? 0,
)
</script>

<template>
  <div class="rounded-[22px] bg-white p-6">
    <h2 class="mb-4 text-base font-extrabold">{{ t('todayAtAGlance.heading') }}</h2>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <div
          class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-app-surface"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0B3D37"
            stroke-width="2"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <div>
          <div class="text-[17px] font-extrabold leading-tight">{{ openTaskCount }}</div>
          <div class="text-[13px] font-semibold text-app-slate">
            {{ t('todayAtAGlance.tasksAssigned') }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div
          class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-app-warning-bg"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D97706"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <div>
          <div class="text-[17px] font-extrabold leading-tight">{{ overdueStepCount }}</div>
          <div class="text-[13px] font-semibold text-app-slate">
            {{ t('todayAtAGlance.stepsNeedAttention') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
