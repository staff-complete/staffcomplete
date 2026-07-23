<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authClient } from '../lib/auth-client'
import { useRunDetail } from '../composables/useRunDetail'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

type Member = { id: string; user: { name: string; email: string } }

const { t } = useI18n()
const route = useRoute()
const type = computed(() => route.params.type as 'onboarding' | 'offboarding')
const id = computed(() => route.params.id as string)

const { data: run, isLoading } = useRunDetail(id.value)

const completedCount = computed(
  () => run.value?.steps.filter((s) => s.status === 'completed').length ?? 0,
)

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

function stepStatusLabel(step: { status: string; isOverdue: boolean }) {
  if (step.status === 'completed') return t('runs.detail.statusStepCompleted')
  if (step.isOverdue) return t('runs.detail.statusStepOverdue')
  return t('runs.detail.statusStepPending')
}

function stepStatusClass(step: { status: string; isOverdue: boolean }) {
  if (step.status === 'completed') return 'bg-green-50 text-green-700'
  if (step.isOverdue) return 'bg-red-50 text-red-600'
  return 'bg-gray-100 text-gray-600'
}

function runStatusLabel(status: string) {
  if (status === 'completed') return t('runs.detail.statusRunCompleted')
  if (status === 'in_progress') return t('runs.detail.statusRunInProgress')
  return t('runs.detail.statusRunPending')
}

const typeLabel = computed(() =>
  type.value === 'offboarding' ? t('common.offboarding') : t('common.onboarding'),
)
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">
          {{ run?.employeeName ?? t('runs.detail.fallbackTitle') }}
        </h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink
            :to="`/runs/${type}`"
            class="text-sm text-brand-teal font-medium hover:underline"
            >{{ t('runs.detail.backToRuns') }}</RouterLink
          >
        </div>
      </div>

      <p v-if="isLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</p>

      <template v-else-if="run">
        <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
          <h2 class="text-lg font-semibold text-brand-dark mb-4">
            {{ t('runs.detail.detailsHeading') }}
          </h2>
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-gray-500">{{ t('runs.detail.typeLabel') }}</dt>
              <dd class="text-brand-dark">{{ typeLabel }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">{{ t('runs.detail.statusLabel') }}</dt>
              <dd class="text-brand-dark">{{ runStatusLabel(run.status) }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">{{ t('runs.detail.emailLabel') }}</dt>
              <dd class="text-brand-dark">{{ run.employeeEmail }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">{{ t('runs.detail.roleLabel') }}</dt>
              <dd class="text-brand-dark">{{ run.employeeRole }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">
                {{
                  run.type === 'offboarding'
                    ? t('runs.detail.lastDayLabel')
                    : t('runs.detail.startsLabel')
                }}
              </dt>
              <dd class="text-brand-dark">{{ run.eventDate }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">{{ t('runs.detail.progressLabel') }}</dt>
              <dd class="text-brand-dark">
                {{
                  t('common.ofStepsComplete', {
                    completed: completedCount,
                    total: run.steps.length,
                    steps: t('common.steps', run.steps.length),
                  })
                }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
          <h2 class="text-lg font-semibold text-brand-dark mb-4">
            {{ t('runs.detail.stepsHeading') }}
          </h2>

          <p v-if="run.steps.length === 0" class="text-sm text-gray-500">
            {{ t('runs.detail.noSteps') }}
          </p>
          <ol v-else class="divide-y divide-brand-border">
            <li
              v-for="step in run.steps"
              :key="step.id"
              class="flex items-center justify-between py-3 gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-brand-dark truncate">{{ step.title }}</p>
                <p class="text-xs text-gray-500">
                  {{
                    step.type === 'manual'
                      ? t('workflows.editor.typeManual')
                      : t('workflows.editor.typeAutomated')
                  }}
                  · {{ memberLabel(step.assigneeId) }}
                  <template v-if="step.dueDate">{{
                    t('runs.detail.dueLabel', { date: step.dueDate })
                  }}</template>
                </p>
              </div>
              <span
                class="shrink-0 text-xs font-semibold px-2 py-1 rounded-full"
                :class="stepStatusClass(step)"
                >{{ stepStatusLabel(step) }}</span
              >
            </li>
          </ol>
        </div>
      </template>

      <p v-else class="text-sm text-gray-500">{{ t('runs.detail.notFound') }}</p>
    </div>
  </div>
</template>
