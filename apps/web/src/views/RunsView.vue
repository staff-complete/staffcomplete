<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplates } from '../composables/useWorkflowTemplates'
import { useRuns } from '../composables/useRuns'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

const { t } = useI18n()
const route = useRoute()
const type = computed(() => route.params.type as 'onboarding' | 'offboarding')
const typeLabel = computed(() =>
  type.value === 'offboarding' ? t('common.offboarding') : t('common.onboarding'),
)
const eventDateLabel = computed(() =>
  type.value === 'offboarding'
    ? t('runs.start.lastWorkingDayLabel')
    : t('runs.start.startDateLabel'),
)

const { data: trialStatus } = useTrialStatus()
// UX only — the server-side source of truth is blockMutationsWhenExpired
// (apps/api/src/middleware/trial-lock.ts), which this same POST request
// hits regardless of what the button here allows.
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const queryClient = useQueryClient()
const { data: templates, isLoading: templatesLoading } = useWorkflowTemplates()
const matchingTemplates = computed(
  () => templates.value?.filter((template) => template.type === type.value) ?? [],
)

const { data: runs, isLoading: runsLoading } = useRuns()
const activeRuns = computed(
  () => runs.value?.filter((r) => r.type === type.value && r.status !== 'completed') ?? [],
)

const form = ref({
  workflowTemplateId: '',
  employeeName: '',
  employeeEmail: '',
  employeeRole: '',
  eventDate: '',
})
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const successMessage = ref('')
const starting = ref(false)

// Switching between /runs/onboarding and /runs/offboarding reuses this
// component — clear stale form state and messages left over from the
// other type.
watch(type, () => {
  form.value = {
    workflowTemplateId: '',
    employeeName: '',
    employeeEmail: '',
    employeeRole: '',
    eventDate: '',
  }
  errors.value = {}
  serverError.value = ''
  successMessage.value = ''
})

const schema = computed(() =>
  z.object({
    workflowTemplateId: z.string().min(1, t('runs.start.validationTemplate')),
    employeeName: z.string().min(2, t('runs.start.validationName')),
    employeeEmail: z.string().email(t('runs.start.validationEmail')),
    employeeRole: z.string().min(1, t('runs.start.validationRole')),
    eventDate: z.string().min(1, t('runs.start.validationDate')),
  }),
)

function runStatusLabel(status: string) {
  if (status === 'completed') return t('runs.start.statusCompleted')
  if (status === 'in_progress') return t('runs.start.statusInProgress')
  return t('runs.start.statusPending')
}

async function startRun() {
  if (isReadOnly.value) return

  errors.value = {}
  serverError.value = ''
  successMessage.value = ''

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      errors.value[field] ||= issue.message
    }
    return
  }

  starting.value = true
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (res.ok) {
      const created = (await res.json()) as { employeeName: string; steps: unknown[] }
      successMessage.value = t('runs.start.successMessage', {
        type: typeLabel.value,
        name: created.employeeName,
        steps: t('common.steps', created.steps.length),
      })
      form.value = {
        workflowTemplateId: '',
        employeeName: '',
        employeeEmail: '',
        employeeRole: '',
        eventDate: '',
      }
      await queryClient.invalidateQueries({ queryKey: ['runs'] })
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? t('common.genericError')
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">
          {{ t('runs.start.title', { type: typeLabel }) }}
        </h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink to="/dashboard" class="text-sm text-brand-teal font-medium hover:underline">{{
            t('common.backToDashboard')
          }}</RouterLink>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">
          {{ t('runs.start.startHeading', { type: typeLabel }) }}
        </h2>

        <p v-if="isReadOnly" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {{ t('runs.start.trialExpired', { type: typeLabel }) }}
        </p>

        <p
          v-else-if="!templatesLoading && matchingTemplates.length === 0"
          class="text-sm text-gray-500"
        >
          {{ t('runs.start.noTemplates', { type: typeLabel }) }}
          <RouterLink to="/workflows" class="text-brand-teal font-medium hover:underline">{{
            t('runs.start.createTemplateFirst')
          }}</RouterLink>
        </p>

        <form v-else class="space-y-4" @submit.prevent="startRun">
          <div>
            <label class="block text-sm font-medium text-brand-dark mb-1" for="template">{{
              t('runs.start.templateLabel')
            }}</label>
            <select
              id="template"
              v-model="form.workflowTemplateId"
              class="w-full px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
            >
              <option value="" disabled>{{ t('runs.start.selectTemplate') }}</option>
              <option v-for="template in matchingTemplates" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>
            <p v-if="errors.workflowTemplateId" class="text-xs text-red-500 mt-1">
              {{ errors.workflowTemplateId }}
            </p>
          </div>

          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="employee-name">{{
                t('runs.start.nameLabel')
              }}</label>
              <input
                id="employee-name"
                v-model="form.employeeName"
                type="text"
                :placeholder="t('runs.start.namePlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.employeeName
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.employeeName" class="text-xs text-red-500 mt-1">
                {{ errors.employeeName }}
              </p>
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="employee-email">{{
                t('runs.start.emailLabel')
              }}</label>
              <input
                id="employee-email"
                v-model="form.employeeEmail"
                type="email"
                :placeholder="t('runs.start.emailPlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.employeeEmail
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.employeeEmail" class="text-xs text-red-500 mt-1">
                {{ errors.employeeEmail }}
              </p>
            </div>
          </div>

          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="employee-role">{{
                t('runs.start.roleLabel')
              }}</label>
              <input
                id="employee-role"
                v-model="form.employeeRole"
                type="text"
                :placeholder="t('runs.start.rolePlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.employeeRole
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.employeeRole" class="text-xs text-red-500 mt-1">
                {{ errors.employeeRole }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="event-date">{{
                eventDateLabel
              }}</label>
              <input
                id="event-date"
                v-model="form.eventDate"
                type="date"
                class="px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.eventDate
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.eventDate" class="text-xs text-red-500 mt-1">
                {{ errors.eventDate }}
              </p>
            </div>
          </div>

          <p
            v-if="successMessage"
            class="text-sm text-brand-teal bg-brand-surface rounded-lg px-3 py-2"
          >
            {{ successMessage }}
          </p>
          <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {{ serverError }}
          </p>

          <button
            type="submit"
            :disabled="starting || isReadOnly"
            class="bg-brand-teal text-white py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity"
            :class="starting || isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
          >
            {{ starting ? t('runs.start.submitting') : t('runs.start.submit') }}
          </button>
        </form>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-brand-dark">
            {{ t('runs.start.activeRunsHeading') }}
          </h2>
          <RouterLink
            :to="`/runs/${type}/history`"
            class="text-sm text-brand-teal font-medium hover:underline"
            >{{ t('runs.start.viewHistory') }}</RouterLink
          >
        </div>

        <p v-if="runsLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</p>
        <p v-else-if="activeRuns.length === 0" class="text-sm text-gray-500">
          {{ t('runs.start.empty') }}
        </p>
        <ul v-else class="divide-y divide-brand-border">
          <li v-for="r in activeRuns" :key="r.id" class="py-3">
            <RouterLink :to="`/runs/${type}/${r.id}`" class="block hover:opacity-80">
              <p class="text-sm font-medium text-brand-dark">{{ r.employeeName }}</p>
              <p class="text-xs text-gray-500">
                {{ r.type === 'offboarding' ? t('common.offboarding') : t('common.onboarding') }}
                · {{ r.type === 'offboarding' ? t('runs.start.lastDay') : t('runs.start.starts') }}
                {{ r.eventDate }} ·
                {{
                  t('common.ofStepsComplete', {
                    completed: r.completedStepCount,
                    total: r.stepCount,
                    steps: t('common.steps', r.stepCount),
                  })
                }}
                · {{ runStatusLabel(r.status) }}
              </p>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
