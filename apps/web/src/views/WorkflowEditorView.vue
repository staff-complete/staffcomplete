<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authClient } from '../lib/auth-client'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplate } from '../composables/useWorkflowTemplates'
import { moveStep } from '../lib/reorderSteps'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

type Member = { id: string; user: { name: string; email: string } }

const { t } = useI18n()
const route = useRoute()
const id = computed(() => route.params.id as string)

const { data: trialStatus } = useTrialStatus()
// UX only — the server-side source of truth is blockMutationsWhenExpired
// (apps/api/src/middleware/trial-lock.ts), which these same POST/DELETE
// requests hit regardless of what the button here allows.
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const queryClient = useQueryClient()
const { data: template, isLoading } = useWorkflowTemplate(id.value)

function invalidate() {
  return queryClient.invalidateQueries({ queryKey: ['workflow-template', id.value] })
}

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

const nameForm = ref({ name: '', type: 'onboarding' as 'onboarding' | 'offboarding' })
const savingName = ref(false)
const nameError = ref('')

watch(
  template,
  (loadedTemplate) => {
    if (loadedTemplate) {
      nameForm.value = { name: loadedTemplate.name, type: loadedTemplate.type }
    }
  },
  { immediate: true },
)

async function saveName() {
  if (isReadOnly.value || !template.value) return
  nameError.value = ''
  if (nameForm.value.name.trim().length < 2) {
    nameError.value = t('workflows.editor.validationName')
    return
  }
  savingName.value = true
  try {
    const res = await fetch(`/api/workflows/${id.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nameForm.value),
    })
    if (res.ok) {
      await invalidate()
    } else {
      const data = (await res.json()) as { message?: string }
      nameError.value = data.message ?? t('common.genericError')
    }
  } finally {
    savingName.value = false
  }
}

const stepForm = ref({
  title: '',
  type: 'manual' as 'automated' | 'manual',
  assigneeId: '',
  dueDateOffsetDays: '' as string | number,
})
const stepError = ref('')
const addingStep = ref(false)

async function addStep() {
  if (isReadOnly.value) return
  stepError.value = ''
  if (stepForm.value.title.trim().length < 2) {
    stepError.value = t('workflows.editor.validationTitle')
    return
  }

  addingStep.value = true
  try {
    const res = await fetch(`/api/workflows/${id.value}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: stepForm.value.title,
        type: stepForm.value.type,
        assigneeId: stepForm.value.assigneeId || null,
        dueDateOffsetDays:
          stepForm.value.type === 'manual' && stepForm.value.dueDateOffsetDays !== ''
            ? Number(stepForm.value.dueDateOffsetDays)
            : null,
      }),
    })

    if (res.ok) {
      stepForm.value = { title: '', type: 'manual', assigneeId: '', dueDateOffsetDays: '' }
      await invalidate()
      return
    }

    const data = (await res.json()) as { message?: string }
    stepError.value = data.message ?? t('common.genericError')
  } finally {
    addingStep.value = false
  }
}

async function deleteStep(stepId: string) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id.value}/steps/${stepId}`, { method: 'DELETE' })
  await invalidate()
}

async function reorder(stepId: string, direction: 'up' | 'down') {
  if (isReadOnly.value || !template.value) return
  const currentIds = template.value.steps.map((s) => s.id)
  const nextIds = moveStep(currentIds, stepId, direction)
  if (nextIds === currentIds) return

  await fetch(`/api/workflows/${id.value}/steps/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepIds: nextIds }),
  })
  await invalidate()
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">
          {{ template?.name ?? t('workflows.editor.fallbackTitle') }}
        </h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink to="/workflows" class="text-sm text-brand-teal font-medium hover:underline">{{
            t('workflows.editor.backToTemplates')
          }}</RouterLink>
        </div>
      </div>

      <p v-if="isLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</p>

      <template v-else-if="template">
        <p v-if="isReadOnly" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {{ t('workflows.editor.trialExpired') }}
        </p>

        <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
          <h2 class="text-lg font-semibold text-brand-dark mb-4">
            {{ t('workflows.editor.detailsHeading') }}
          </h2>
          <form class="flex gap-3 items-end" @submit.prevent="saveName">
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="template-name">{{
                t('workflows.editor.nameLabel')
              }}</label>
              <input
                id="template-name"
                v-model="nameForm.name"
                type="text"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  nameError
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="template-type">{{
                t('workflows.editor.typeLabel')
              }}</label>
              <select
                id="template-type"
                v-model="nameForm.type"
                class="px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
              >
                <option value="onboarding">{{ t('common.onboarding') }}</option>
                <option value="offboarding">{{ t('common.offboarding') }}</option>
              </select>
            </div>
            <button
              type="submit"
              :disabled="savingName || isReadOnly"
              class="bg-brand-teal text-white py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity"
              :class="
                savingName || isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
              "
            >
              {{ savingName ? t('workflows.editor.saving') : t('workflows.editor.save') }}
            </button>
          </form>
          <p v-if="nameError" class="text-xs text-red-500 mt-2">{{ nameError }}</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
          <h2 class="text-lg font-semibold text-brand-dark mb-4">
            {{ t('workflows.editor.stepsHeading') }}
          </h2>

          <p v-if="template.steps.length === 0" class="text-sm text-gray-500 mb-4">
            {{ t('workflows.editor.noSteps') }}
          </p>
          <ol v-else class="divide-y divide-brand-border mb-6">
            <li
              v-for="(step, index) in template.steps"
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
                  <template v-if="step.type === 'manual' && step.dueDateOffsetDays !== null">
                    {{ t('workflows.editor.dueAfterStart', { days: step.dueDateOffsetDays }) }}
                  </template>
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  :disabled="isReadOnly || index === 0"
                  class="text-sm text-brand-dark disabled:opacity-30 disabled:cursor-not-allowed hover:text-brand-teal"
                  :aria-label="t('workflows.editor.moveUp')"
                  @click="reorder(step.id, 'up')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  :disabled="isReadOnly || index === template.steps.length - 1"
                  class="text-sm text-brand-dark disabled:opacity-30 disabled:cursor-not-allowed hover:text-brand-teal"
                  :aria-label="t('workflows.editor.moveDown')"
                  @click="reorder(step.id, 'down')"
                >
                  ↓
                </button>
                <button
                  type="button"
                  :disabled="isReadOnly"
                  class="text-sm text-red-500 font-medium"
                  :class="isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:underline'"
                  @click="deleteStep(step.id)"
                >
                  {{ t('workflows.editor.delete') }}
                </button>
              </div>
            </li>
          </ol>

          <form class="space-y-4 border-t border-brand-border pt-6" @submit.prevent="addStep">
            <h3 class="text-sm font-semibold text-brand-dark">
              {{ t('workflows.editor.addStepHeading') }}
            </h3>
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="step-title">{{
                t('workflows.editor.titleLabel')
              }}</label>
              <input
                id="step-title"
                v-model="stepForm.title"
                type="text"
                :placeholder="t('workflows.editor.titlePlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  stepError
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
            </div>

            <div class="flex gap-3">
              <div>
                <label class="block text-sm font-medium text-brand-dark mb-1" for="step-type">{{
                  t('workflows.editor.typeLabel')
                }}</label>
                <select
                  id="step-type"
                  v-model="stepForm.type"
                  class="px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
                >
                  <option value="manual">{{ t('workflows.editor.typeManual') }}</option>
                  <option value="automated">{{ t('workflows.editor.typeAutomated') }}</option>
                </select>
              </div>

              <div class="flex-1">
                <label class="block text-sm font-medium text-brand-dark mb-1" for="step-assignee">{{
                  t('workflows.editor.assigneeLabel')
                }}</label>
                <select
                  id="step-assignee"
                  v-model="stepForm.assigneeId"
                  class="w-full px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
                >
                  <option value="">{{ t('common.unassigned') }}</option>
                  <option v-for="member in members" :key="member.id" :value="member.id">
                    {{ member.user.name }}
                  </option>
                </select>
              </div>

              <div v-if="stepForm.type === 'manual'">
                <label class="block text-sm font-medium text-brand-dark mb-1" for="step-due">{{
                  t('workflows.editor.dueDaysLabel')
                }}</label>
                <input
                  id="step-due"
                  v-model="stepForm.dueDateOffsetDays"
                  type="number"
                  min="0"
                  placeholder="2"
                  class="w-24 px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            <p v-if="stepError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {{ stepError }}
            </p>

            <button
              type="submit"
              :disabled="addingStep || isReadOnly"
              class="bg-brand-teal text-white py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity"
              :class="
                addingStep || isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
              "
            >
              {{ addingStep ? t('workflows.editor.submitting') : t('workflows.editor.submit') }}
            </button>
          </form>
        </div>
      </template>

      <p v-else class="text-sm text-gray-500">{{ t('workflows.editor.notFound') }}</p>
    </div>
  </div>
</template>
