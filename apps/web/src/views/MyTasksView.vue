<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { completeTask, useMyTasks } from '../composables/useMyTasks'
import { avatarColorsFor, initialsFor } from '../lib/avatarColors'

const { t } = useI18n()
const queryClient = useQueryClient()
const { data: tasks, isLoading } = useMyTasks()
const openTasks = computed(() =>
  (tasks.value ?? [])
    .filter((task) => task.status === 'pending')
    .map((task) => {
      const colors = avatarColorsFor(task.run.employeeName)
      return {
        ...task,
        initials: initialsFor(task.run.employeeName),
        avatarBg: colors.bg,
        avatarText: colors.color,
        typeLabel:
          task.run.type === 'offboarding' ? t('common.offboarding') : t('common.onboarding'),
      }
    }),
)

const completingId = ref<string | null>(null)
const errorMessage = ref('')

async function markComplete(id: string) {
  errorMessage.value = ''
  completingId.value = id
  try {
    await completeTask(id)
    await queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
  } catch {
    errorMessage.value = t('myTasks.completeError')
  } finally {
    completingId.value = null
  }
}
</script>

<template>
  <div>
    <h1 class="mb-1.5 text-2xl font-extrabold tracking-tight">{{ t('nav.myTasks') }}</h1>
    <p class="mb-6 text-[15px] text-app-slate">{{ t('myTasks.subtitle') }}</p>

    <div class="rounded-3xl bg-white px-7 py-2">
      <p
        v-if="errorMessage"
        class="mt-4 rounded-xl bg-app-danger-bg px-3.5 py-2.5 text-sm text-app-danger"
      >
        {{ errorMessage }}
      </p>

      <p v-if="isLoading" class="py-6 text-sm text-app-muted">{{ t('common.loading') }}</p>
      <p v-else-if="openTasks.length === 0" class="py-6 text-sm text-app-muted">
        {{ t('myTasks.empty') }}
      </p>
      <div
        v-for="task in openTasks"
        :key="task.id"
        class="flex items-center gap-4.5 border-b border-app-surface-alt py-5 last:border-0"
      >
        <div
          class="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-full text-[13.5px] font-bold"
          :style="{ background: task.avatarBg, color: task.avatarText }"
        >
          {{ task.initials }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="mb-1 text-[15.5px] font-bold">{{ task.title }}</div>
          <div class="text-[13.5px] text-app-slate">
            {{ task.run.employeeName }} · {{ task.typeLabel }}
            <span v-if="task.isOverdue" class="font-bold text-app-warning">
              · {{ t('runs.detail.statusStepOverdue') }}</span
            >
          </div>
        </div>
        <span
          v-if="task.isLocked"
          class="shrink-0 whitespace-nowrap rounded-full bg-app-surface-alt px-5.5 py-3 text-sm font-bold text-app-muted"
        >
          {{ t('myTasks.waitingOnEarlierSteps') }}
        </span>
        <button
          v-else
          type="button"
          :disabled="completingId === task.id"
          class="shrink-0 whitespace-nowrap rounded-full bg-app-accent px-5.5 py-3 text-sm font-bold text-white"
          :class="completingId === task.id ? 'opacity-60' : ''"
          @click="markComplete(task.id)"
        >
          {{ completingId === task.id ? t('myTasks.completing') : t('myTasks.markComplete') }}
        </button>
      </div>
    </div>
  </div>
</template>
