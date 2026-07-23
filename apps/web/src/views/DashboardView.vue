<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { differenceInCalendarDays } from 'date-fns'
import { authClient } from '../lib/auth-client'
import { useRuns } from '../composables/useRuns'
import { avatarColorsFor, initialsFor } from '../lib/avatarColors'
import { runHealth } from '../lib/runHealth'

const { t } = useI18n()
const session = authClient.useSession()
const { data: runs, isLoading } = useRuns()

const activeRuns = computed(() => runs.value?.filter((r) => r.status !== 'completed') ?? [])

const startingSoonCount = computed(
  () =>
    activeRuns.value.filter((r) => {
      if (r.type !== 'onboarding') return false
      const days = differenceInCalendarDays(new Date(`${r.eventDate}T00:00:00`), new Date())
      return days >= 0 && days <= 7
    }).length,
)
const overdueStepTotal = computed(() =>
  activeRuns.value.reduce((sum, r) => sum + r.overdueStepCount, 0),
)
const blockedCount = computed(
  () => activeRuns.value.filter((r) => runHealth(r) === 'blocked').length,
)
const finishingThisWeekCount = computed(
  () =>
    activeRuns.value.filter((r) => {
      const remaining = r.stepCount - r.completedStepCount
      return remaining > 0 && remaining <= 3
    }).length,
)

const attentionItems = computed(() =>
  activeRuns.value
    .filter((r) => runHealth(r) === 'blocked')
    .map((r) => ({
      id: r.id,
      name: r.employeeName,
      reason: t('dashboard.attentionReason', { step: r.overdueStepTitle }),
    })),
)

function statusKey(run: { status: string; overdueStepCount: number }) {
  const health = runHealth(run)
  if (health === 'completed') return 'completed'
  return health
}

const peopleInProgress = computed(() =>
  activeRuns.value.slice(0, 4).map((r) => {
    const colors = avatarColorsFor(r.employeeName)
    return {
      ...r,
      initials: initialsFor(r.employeeName),
      avatarBg: colors.bg,
      avatarText: colors.color,
      statusKey: statusKey(r),
    }
  }),
)
</script>

<template>
  <div>
    <div class="relative mb-5 overflow-hidden rounded-3xl bg-app-surface px-8 py-6">
      <div class="relative flex flex-wrap items-center justify-between gap-6">
        <div class="max-w-[420px]">
          <h1 class="mb-1 text-2xl font-extrabold tracking-tight text-app-ink">
            {{ t('dashboard.greeting', { name: session.data?.user.name ?? '' }) }}
          </h1>
          <p class="text-[14.5px] text-app-slate">
            {{ t('dashboard.subtitle', activeRuns.length) }}
          </p>
        </div>
        <RouterLink
          to="/tasks"
          class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-app-ink px-5 py-3 text-sm font-bold text-white"
        >
          {{ t('dashboard.viewTodaysWork') }}
        </RouterLink>
      </div>
    </div>

    <div class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <RouterLink to="/runs?filter=onboarding" class="rounded-[20px] bg-white px-5.5 py-5">
        <div class="text-[30px] font-extrabold leading-tight text-app-ink">
          {{ startingSoonCount }}
        </div>
        <div class="mt-1 text-[13.5px] font-semibold text-app-slate">
          {{ t('dashboard.startingSoon') }}
        </div>
      </RouterLink>
      <RouterLink to="/runs?filter=overdue" class="rounded-[20px] bg-white px-5.5 py-5">
        <div class="text-[30px] font-extrabold leading-tight text-app-warning">
          {{ overdueStepTotal }}
        </div>
        <div class="mt-1 text-[13.5px] font-semibold text-app-slate">
          {{ t('dashboard.overdueTasks') }}
        </div>
      </RouterLink>
      <RouterLink to="/runs?filter=overdue" class="rounded-[20px] bg-white px-5.5 py-5">
        <div class="text-[30px] font-extrabold leading-tight text-app-danger">
          {{ blockedCount }}
        </div>
        <div class="mt-1 text-[13.5px] font-semibold text-app-slate">
          {{ t('dashboard.blockedProcesses') }}
        </div>
      </RouterLink>
      <RouterLink to="/runs?filter=active" class="rounded-[20px] bg-white px-5.5 py-5">
        <div class="text-[30px] font-extrabold leading-tight text-app-ink">
          {{ finishingThisWeekCount }}
        </div>
        <div class="mt-1 text-[13.5px] font-semibold text-app-slate">
          {{ t('dashboard.finishingThisWeek') }}
        </div>
      </RouterLink>
    </div>

    <div v-if="attentionItems.length > 0" class="mb-5 rounded-[20px] bg-white px-5.5 py-4.5">
      <h2 class="mb-3 flex items-center gap-2 text-[15px] font-extrabold">
        {{ t('dashboard.needsAttention') }}
        <span
          class="rounded-full bg-app-danger-bg px-2.5 py-0.5 text-xs font-extrabold text-app-danger-text"
        >
          {{ attentionItems.length }}
        </span>
      </h2>
      <div class="flex flex-col">
        <RouterLink
          v-for="item in attentionItems"
          :key="item.id"
          :to="`/runs/${item.id}`"
          class="flex items-center gap-3 rounded-xl px-1.5 py-2.5"
        >
          <div class="h-2 w-2 shrink-0 rounded-full bg-app-danger" />
          <div class="min-w-0 flex-1 text-sm text-app-ink">
            <b>{{ item.name }}</b> — {{ item.reason }}
          </div>
        </RouterLink>
      </div>
    </div>

    <div class="rounded-3xl bg-white px-6 pb-2 pt-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-extrabold">{{ t('dashboard.peopleInProgress') }}</h2>
        <RouterLink to="/runs" class="text-sm font-bold text-app-ink">{{
          t('dashboard.viewAll')
        }}</RouterLink>
      </div>

      <p v-if="isLoading" class="pb-4 text-sm text-app-muted">{{ t('common.loading') }}</p>
      <p v-else-if="peopleInProgress.length === 0" class="pb-4 text-sm text-app-muted">
        {{ t('dashboard.empty') }}
      </p>
      <RouterLink
        v-for="run in peopleInProgress"
        :key="run.id"
        :to="`/runs/${run.id}`"
        class="flex items-center gap-3.5 border-b border-app-surface-alt py-3.5 last:border-0"
      >
        <div
          class="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-full text-[13.5px] font-bold"
          :style="{ background: run.avatarBg, color: run.avatarText }"
        >
          {{ run.initials }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="mb-0.5 flex items-center gap-2">
            <span class="text-[15px] font-bold">{{ run.employeeName }}</span>
            <span
              class="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
              :class="{
                'bg-app-success-bg text-app-success': run.statusKey === 'onTrack',
                'bg-app-danger-bg text-app-danger-text': run.statusKey === 'blocked',
                'bg-app-surface text-app-ink': run.statusKey === 'completed',
              }"
              >{{ t(`runs.status.${run.statusKey}`) }}</span
            >
          </div>
          <div class="truncate text-[13px] text-app-muted">
            {{
              t('common.ofStepsComplete', {
                completed: run.completedStepCount,
                total: run.stepCount,
                steps: t('common.steps', run.stepCount),
              })
            }}
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
