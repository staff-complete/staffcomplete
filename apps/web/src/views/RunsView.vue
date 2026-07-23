<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplates } from '../composables/useWorkflowTemplates'
import { useRuns, type RunSummary } from '../composables/useRuns'
import { avatarColorsFor, initialsFor } from '../lib/avatarColors'
import { runHealth } from '../lib/runHealth'
import StartRunModal from '../components/StartRunModal.vue'

type FilterKey = 'all' | 'onboarding' | 'offboarding' | 'active' | 'completed' | 'overdue'

const { t } = useI18n()
const route = useRoute()

const { data: trialStatus } = useTrialStatus()
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const { data: templates } = useWorkflowTemplates()
const { data: runs, isLoading } = useRuns()

const initialFilter = route.query.filter
const validFilters: FilterKey[] = [
  'all',
  'onboarding',
  'offboarding',
  'active',
  'completed',
  'overdue',
]
const filter = ref<FilterKey>(
  validFilters.includes(initialFilter as FilterKey) ? (initialFilter as FilterKey) : 'all',
)

const filterDefs = computed(() => [
  { key: 'all' as const, label: t('runs.list.filterAll') },
  { key: 'onboarding' as const, label: t('common.onboarding') },
  { key: 'offboarding' as const, label: t('common.offboarding') },
  { key: 'active' as const, label: t('runs.list.filterActive') },
  { key: 'completed' as const, label: t('runs.list.filterCompleted') },
  { key: 'overdue' as const, label: t('runs.status.blocked') },
])

function matchesFilter(run: RunSummary): boolean {
  switch (filter.value) {
    case 'all':
      return true
    case 'onboarding':
      return run.type === 'onboarding'
    case 'offboarding':
      return run.type === 'offboarding'
    case 'active':
      return run.status !== 'completed'
    case 'completed':
      return run.status === 'completed'
    case 'overdue':
      return runHealth(run) === 'blocked'
  }
}

const decoratedRuns = computed(() =>
  (runs.value ?? []).filter(matchesFilter).map((run) => {
    const colors = avatarColorsFor(run.employeeName)
    const health = runHealth(run)
    return {
      ...run,
      initials: initialsFor(run.employeeName),
      avatarBg: colors.bg,
      avatarText: colors.color,
      typeLabel: run.type === 'offboarding' ? t('common.offboarding') : t('common.onboarding'),
      statusKey: health,
      progressPct:
        run.stepCount === 0 ? 100 : Math.round((run.completedStepCount / run.stepCount) * 100),
    }
  }),
)

const showModal = ref(false)
</script>

<template>
  <div>
    <div class="mb-5.5 flex items-center justify-between">
      <div>
        <h1 class="mb-1.5 text-2xl font-extrabold tracking-tight">{{ t('nav.runs') }}</h1>
        <p class="text-[15px] text-app-slate">{{ t('runs.list.subtitle') }}</p>
      </div>
      <button
        type="button"
        :disabled="isReadOnly"
        class="flex items-center gap-2 whitespace-nowrap rounded-full bg-app-accent px-6 py-3.5 text-white"
        :class="isReadOnly ? 'opacity-60' : ''"
        @click="showModal = true"
      >
        <span class="text-[14.5px] font-bold">{{ t('runs.list.startButton') }}</span>
      </button>
    </div>

    <p
      v-if="isReadOnly"
      class="mb-4 rounded-xl bg-app-warning-bg px-3.5 py-2.5 text-sm text-app-warning"
    >
      {{ t('runs.list.trialExpired') }}
    </p>

    <div class="mb-5.5 flex flex-wrap gap-2.5">
      <button
        v-for="f in filterDefs"
        :key="f.key"
        type="button"
        class="whitespace-nowrap rounded-full px-4.5 py-2.5 text-sm font-bold"
        :class="filter === f.key ? 'bg-app-accent text-white' : 'bg-white text-app-slate'"
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-app-muted">{{ t('common.loading') }}</p>
    <p v-else-if="decoratedRuns.length === 0" class="text-sm text-app-muted">
      {{ t('runs.list.empty') }}
    </p>
    <div v-else class="flex flex-col gap-3.5">
      <RouterLink
        v-for="run in decoratedRuns"
        :key="run.id"
        :to="`/runs/${run.id}`"
        class="flex flex-wrap items-center gap-5 rounded-[20px] bg-white px-6 py-4.5"
      >
        <div
          class="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          :style="{ background: run.avatarBg, color: run.avatarText }"
        >
          {{ run.initials }}
        </div>
        <div class="w-[170px] shrink-0 min-w-0">
          <div class="truncate text-[15.5px] font-bold">{{ run.employeeName }}</div>
          <div class="truncate text-[13px] text-app-muted">{{ run.employeeRole }}</div>
        </div>
        <span
          class="shrink-0 whitespace-nowrap rounded-full bg-app-surface-alt px-3.5 py-1 text-[12.5px] font-bold text-app-slate"
        >
          {{ run.typeLabel }}
        </span>
        <div class="min-w-[130px] flex-1">
          <div class="mb-1.5 h-1.75 overflow-hidden rounded-full bg-app-surface-alt">
            <div
              class="h-full rounded-full bg-app-accent"
              :style="{ width: `${run.progressPct}%` }"
            />
          </div>
          <div class="whitespace-nowrap text-[12.5px] text-app-muted">
            {{
              t('runs.list.stepsProgress', {
                completed: run.completedStepCount,
                total: run.stepCount,
                steps: t('common.steps', run.stepCount),
              })
            }}
          </div>
        </div>
        <span
          class="shrink-0 whitespace-nowrap rounded-full px-3.5 py-1 text-[12.5px] font-bold"
          :class="{
            'bg-app-success-bg text-app-success': run.statusKey === 'onTrack',
            'bg-app-danger-bg text-app-danger-text': run.statusKey === 'blocked',
            'bg-app-surface text-app-ink': run.statusKey === 'completed',
          }"
        >
          {{ t(`runs.status.${run.statusKey}`) }}
        </span>
        <div
          class="w-[84px] shrink-0 whitespace-nowrap text-end text-sm"
          :class="run.statusKey === 'blocked' ? 'font-bold text-app-warning' : 'text-app-muted'"
        >
          {{ run.eventDate }}
        </div>
      </RouterLink>
    </div>

    <StartRunModal v-if="showModal" :templates="templates ?? []" @close="showModal = false" />
  </div>
</template>
