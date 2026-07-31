<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { authClient } from '../lib/auth-client'
import { ApiError, apiFetch } from '../lib/api'
import { useRunDetail } from '../composables/useRunDetail'
import { avatarColorsFor, initialsFor } from '../lib/avatarColors'
import { runHealth } from '../lib/runHealth'
import LoadError from '../components/LoadError.vue'

type Member = { id: string; user: { name: string; email: string } }

const { t } = useI18n()
const route = useRoute()
const id = computed(() => route.params.id as string)

const { data: run, isLoading, isError, error, refetch, isFetching } = useRunDetail(id.value)
const queryClient = useQueryClient()
const reassigningStepId = ref<string | null>(null)
const reassignErrorStepId = ref<string | null>(null)
const reassignError = ref('')

async function reassignStep(stepId: string, assigneeId: string) {
  reassignErrorStepId.value = null
  reassignError.value = ''
  reassigningStepId.value = stepId
  try {
    await apiFetch(`/api/runs/${id.value}/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    })
    await queryClient.invalidateQueries({ queryKey: ['runs', id.value] })
  } catch (err) {
    reassignErrorStepId.value = stepId
    reassignError.value = err instanceof ApiError ? err.message : t('common.networkError')
  } finally {
    reassigningStepId.value = null
  }
}

const completedCount = computed(
  () => run.value?.steps.filter((s) => s.status === 'completed').length ?? 0,
)
const overdueCount = computed(() => run.value?.steps.filter((s) => s.isOverdue).length ?? 0)

// Steps within a phase can be worked on in parallel; phases themselves run
// in order and a locked phase's steps aren't actionable yet (see
// packages/shared/src/phase.ts). Both arrays already come sorted by position.
const phasesWithSteps = computed(() => {
  const phases = run.value?.phases ?? []
  const steps = run.value?.steps ?? []
  return phases.map((phase) => ({
    ...phase,
    steps: steps.filter((step) => step.phaseId === phase.id),
  }))
})
const statusKey = computed(() =>
  run.value
    ? runHealth({ status: run.value.status, overdueStepCount: overdueCount.value })
    : 'onTrack',
)

const avatar = computed(() => (run.value ? avatarColorsFor(run.value.employeeName) : null))

const members = ref<Member[]>([])
onMounted(async () => {
  const { data } = await authClient.organization.listMembers()
  members.value = (data?.members ?? []) as Member[]
})

function memberLabel(memberId: string | null) {
  if (!memberId) return t('common.unassigned')
  const member = members.value.find((m) => m.id === memberId)
  return member ? member.user.name : t('common.unassigned')
}

// An automated step's action is fixed system vocabulary, not user-authored
// content, so its label is translated via i18n — but the step's own title
// is real content now (a template can have several steps using the same
// action, distinguished by title), so it's shown as-is, same as a manual
// step's title.
function automatedActionLabel(action: string) {
  return t(`checklists.automatedActions.${action}`)
}

function stepStatusLabel(step: { status: string; isOverdue: boolean }) {
  if (step.status === 'completed') return t('runs.detail.statusStepCompleted')
  if (step.isOverdue) return t('runs.detail.statusStepOverdue')
  return t('runs.detail.statusStepPending')
}

function stepStatusClass(step: { status: string; isOverdue: boolean }) {
  if (step.status === 'completed') return 'bg-app-success-bg text-app-success'
  if (step.isOverdue) return 'bg-app-danger-bg text-app-danger-text'
  return 'bg-app-surface-alt text-app-slate'
}

const typeLabel = computed(() =>
  run.value?.type === 'offboarding' ? t('common.offboarding') : t('common.onboarding'),
)
</script>

<template>
  <div>
    <RouterLink
      to="/runs"
      class="mb-5 flex w-fit items-center gap-1.5 text-[14.5px] font-bold text-app-ink"
    >
      {{ t('runs.detail.backToRuns') }}
    </RouterLink>

    <p v-if="isLoading" class="text-sm text-app-muted">{{ t('common.loading') }}</p>

    <LoadError v-else-if="isError" :error="error" :retrying="isFetching" @retry="refetch()" />

    <template v-else-if="run">
      <div class="mb-5 rounded-3xl bg-white p-7">
        <div class="mb-2.5 flex flex-wrap items-center gap-4.5">
          <div
            class="flex h-14.5 w-14.5 shrink-0 items-center justify-center rounded-full text-[19px] font-bold"
            :style="{ background: avatar?.bg, color: avatar?.color }"
          >
            {{ initialsFor(run.employeeName) }}
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="mb-1 text-[22px] font-extrabold tracking-tight">{{ run.employeeName }}</h1>
            <div class="text-[14.5px] text-app-slate">
              {{ run.employeeRole }} · {{ run.employeeEmail }}
            </div>
          </div>
          <span
            class="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
            :class="{
              'bg-app-success-bg text-app-success': statusKey === 'onTrack',
              'bg-app-danger-bg text-app-danger-text': statusKey === 'blocked',
              'bg-app-surface text-app-ink': statusKey === 'completed',
            }"
          >
            {{ t(`runs.status.${statusKey}`) }}
          </span>
        </div>
        <div class="mt-4.5">
          <div class="mb-2 flex justify-between">
            <span class="text-[14.5px] font-bold text-app-slate">
              {{
                t('common.ofStepsComplete', {
                  completed: completedCount,
                  total: run.steps.length,
                  steps: t('common.steps', run.steps.length),
                })
              }}
            </span>
            <span class="text-[14.5px] font-extrabold">
              {{
                run.steps.length === 0 ? 0 : Math.round((completedCount / run.steps.length) * 100)
              }}%
            </span>
          </div>
          <div class="h-2.25 overflow-hidden rounded-full bg-app-surface-alt">
            <div
              class="h-full rounded-full bg-app-accent"
              :style="{
                width: `${run.steps.length === 0 ? 0 : Math.round((completedCount / run.steps.length) * 100)}%`,
              }"
            />
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-5 rounded-3xl bg-white p-7 text-sm sm:grid-cols-4">
        <div>
          <div class="text-app-muted">{{ t('runs.detail.typeLabel') }}</div>
          <div class="text-app-ink">{{ typeLabel }}</div>
        </div>
        <div>
          <div class="text-app-muted">{{ t('runs.detail.statusLabel') }}</div>
          <div class="text-app-ink">{{ t(`runs.status.${statusKey}`) }}</div>
        </div>
        <div>
          <div class="text-app-muted">
            {{
              run.type === 'offboarding'
                ? t('runs.detail.lastDayLabel')
                : t('runs.detail.startsLabel')
            }}
          </div>
          <div class="text-app-ink">{{ run.eventDate }}</div>
        </div>
      </div>

      <div class="rounded-3xl bg-white px-7 pb-5 pt-2.5">
        <h2 class="mb-4 px-0 pt-4 text-lg font-extrabold">{{ t('runs.detail.stepsHeading') }}</h2>

        <p v-if="run.steps.length === 0" class="text-sm text-app-muted">
          {{ t('runs.detail.noSteps') }}
        </p>
        <div v-for="phase in phasesWithSteps" :key="phase.id" class="mb-2 last:mb-0">
          <div class="mb-1 mt-4 flex items-center gap-2 first:mt-0">
            <h3 class="text-sm font-extrabold text-app-slate">{{ phase.name }}</h3>
            <span
              v-if="phase.isLocked"
              class="rounded-full bg-app-surface-alt px-2 py-0.5 text-[11px] font-semibold text-app-muted"
              :title="t('runs.detail.phaseLockedHint')"
            >
              {{ t('runs.detail.phaseLocked') }}
            </span>
          </div>
          <ol class="flex flex-col">
            <li
              v-for="step in phase.steps"
              :key="step.id"
              class="flex items-center justify-between gap-3 border-b border-app-surface-alt py-4.5 last:border-0"
              :class="step.isLocked ? 'opacity-50' : ''"
            >
              <div class="min-w-0">
                <p
                  class="truncate text-[15.5px] font-bold"
                  :class="step.status === 'completed' ? 'text-app-muted line-through' : ''"
                >
                  {{ step.title }}
                </p>
                <p class="mt-1 flex items-center gap-1.5 text-[13px] text-app-muted">
                  <template v-if="step.type === 'manual'">
                    <select
                      v-if="step.status !== 'completed'"
                      :aria-label="t('runs.detail.reassignAriaLabel')"
                      :value="step.assigneeId ?? ''"
                      :disabled="reassigningStepId === step.id"
                      class="rounded-md border border-app-border bg-white px-1.5 py-0.5 text-[13px] text-app-muted outline-none disabled:opacity-50"
                      @change="reassignStep(step.id, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">{{ t('common.unassigned') }}</option>
                      <option v-for="member in members" :key="member.id" :value="member.id">
                        {{ member.user.name }}
                      </option>
                    </select>
                    <template v-else>{{ memberLabel(step.assigneeId) }}</template>
                    <template v-if="step.dueDate">{{
                      t('runs.detail.dueLabel', { date: step.dueDate })
                    }}</template>
                  </template>
                  <template v-else-if="step.action">{{
                    automatedActionLabel(step.action)
                  }}</template>
                </p>
                <p
                  v-if="reassignErrorStepId === step.id"
                  class="mt-1 text-[12px] text-app-danger-text"
                >
                  {{ reassignError }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
                :class="stepStatusClass(step)"
                >{{ stepStatusLabel(step) }}</span
              >
            </li>
          </ol>
        </div>
      </div>
    </template>

    <p v-else class="text-sm text-app-muted">{{ t('runs.detail.notFound') }}</p>
  </div>
</template>
