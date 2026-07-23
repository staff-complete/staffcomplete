<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authClient } from '../lib/auth-client'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplate } from '../composables/useWorkflowTemplates'
import { moveStep } from '../lib/reorderSteps'

type Member = { id: string; user: { name: string; email: string } }

const { t } = useI18n()
const route = useRoute()
const id = computed(() => route.params.id as string)

const { data: trialStatus } = useTrialStatus()
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
  <div>
    <RouterLink
      to="/workflows"
      class="mb-5 flex w-fit items-center gap-1.5 text-[14.5px] font-bold text-app-ink"
    >
      {{ t('workflows.editor.backToTemplates') }}
    </RouterLink>

    <p v-if="isLoading" class="text-sm text-app-muted">{{ t('common.loading') }}</p>

    <template v-else-if="template">
      <h1 class="mb-5 text-2xl font-extrabold tracking-tight">
        {{ template.name || t('workflows.editor.fallbackTitle') }}
      </h1>

      <p
        v-if="isReadOnly"
        class="mb-4 rounded-xl bg-app-warning-bg px-3.5 py-2.5 text-sm text-app-warning"
      >
        {{ t('workflows.editor.trialExpired') }}
      </p>

      <div class="mb-5 rounded-3xl bg-white p-7">
        <h2 class="mb-4 text-lg font-extrabold">{{ t('workflows.editor.detailsHeading') }}</h2>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="saveName">
          <div class="min-w-[200px] flex-1">
            <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="template-name">{{
              t('workflows.editor.nameLabel')
            }}</label>
            <input
              id="template-name"
              v-model="nameForm.name"
              type="text"
              class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="template-type">{{
              t('workflows.editor.typeLabel')
            }}</label>
            <select
              id="template-type"
              v-model="nameForm.type"
              class="rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
            >
              <option value="onboarding">{{ t('common.onboarding') }}</option>
              <option value="offboarding">{{ t('common.offboarding') }}</option>
            </select>
          </div>
          <button
            type="submit"
            :disabled="savingName || isReadOnly"
            class="whitespace-nowrap rounded-full bg-app-accent px-6 py-3 text-sm font-bold text-white"
            :class="savingName || isReadOnly ? 'opacity-60' : ''"
          >
            {{ savingName ? t('workflows.editor.saving') : t('workflows.editor.save') }}
          </button>
        </form>
        <p v-if="nameError" class="mt-2 text-xs text-app-danger">{{ nameError }}</p>
      </div>

      <div class="rounded-3xl bg-white p-7">
        <h2 class="mb-4 text-lg font-extrabold">{{ t('workflows.editor.stepsHeading') }}</h2>

        <p v-if="template.steps.length === 0" class="mb-4 text-sm text-app-muted">
          {{ t('workflows.editor.noSteps') }}
        </p>
        <ol v-else class="mb-6 flex flex-col">
          <li
            v-for="(step, index) in template.steps"
            :key="step.id"
            class="flex items-center justify-between gap-3 border-b border-app-surface-alt py-4 last:border-0"
          >
            <div class="min-w-0">
              <p class="truncate text-[15.5px] font-bold">{{ step.title }}</p>
              <p class="mt-0.5 text-[13px] text-app-muted">
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
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                :disabled="isReadOnly || index === 0"
                class="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-app-ink disabled:opacity-30"
                :aria-label="t('workflows.editor.moveUp')"
                @click="reorder(step.id, 'up')"
              >
                ↑
              </button>
              <button
                type="button"
                :disabled="isReadOnly || index === template.steps.length - 1"
                class="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-app-ink disabled:opacity-30"
                :aria-label="t('workflows.editor.moveDown')"
                @click="reorder(step.id, 'down')"
              >
                ↓
              </button>
              <button
                type="button"
                :disabled="isReadOnly"
                class="text-sm font-bold text-app-danger"
                :class="isReadOnly ? 'opacity-60' : ''"
                @click="deleteStep(step.id)"
              >
                {{ t('workflows.editor.delete') }}
              </button>
            </div>
          </li>
        </ol>

        <form
          class="flex flex-col gap-4 border-t border-app-surface-alt pt-6"
          @submit.prevent="addStep"
        >
          <h3 class="text-sm font-extrabold">{{ t('workflows.editor.addStepHeading') }}</h3>
          <div>
            <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="step-title">{{
              t('workflows.editor.titleLabel')
            }}</label>
            <input
              id="step-title"
              v-model="stepForm.title"
              type="text"
              :placeholder="t('workflows.editor.titlePlaceholder')"
              class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
            />
          </div>

          <div class="flex flex-wrap gap-3">
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="step-type">{{
                t('workflows.editor.typeLabel')
              }}</label>
              <select
                id="step-type"
                v-model="stepForm.type"
                class="rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
              >
                <option value="manual">{{ t('workflows.editor.typeManual') }}</option>
                <option value="automated">{{ t('workflows.editor.typeAutomated') }}</option>
              </select>
            </div>

            <div class="min-w-[180px] flex-1">
              <label
                class="mb-1.5 block text-[13px] font-bold text-app-slate"
                for="step-assignee"
                >{{ t('workflows.editor.assigneeLabel') }}</label
              >
              <select
                id="step-assignee"
                v-model="stepForm.assigneeId"
                class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
              >
                <option value="">{{ t('common.unassigned') }}</option>
                <option v-for="member in members" :key="member.id" :value="member.id">
                  {{ member.user.name }}
                </option>
              </select>
            </div>

            <div v-if="stepForm.type === 'manual'">
              <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="step-due">{{
                t('workflows.editor.dueDaysLabel')
              }}</label>
              <input
                id="step-due"
                v-model="stepForm.dueDateOffsetDays"
                type="number"
                min="0"
                placeholder="2"
                class="w-24 rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
              />
            </div>
          </div>

          <p
            v-if="stepError"
            class="rounded-xl bg-app-danger-bg px-3.5 py-2.5 text-sm text-app-danger"
          >
            {{ stepError }}
          </p>

          <button
            type="submit"
            :disabled="addingStep || isReadOnly"
            class="w-fit whitespace-nowrap rounded-full bg-app-accent px-6 py-3 text-sm font-bold text-white"
            :class="addingStep || isReadOnly ? 'opacity-60' : ''"
          >
            {{ addingStep ? t('workflows.editor.submitting') : t('workflows.editor.submit') }}
          </button>
        </form>
      </div>
    </template>

    <p v-else class="text-sm text-app-muted">{{ t('workflows.editor.notFound') }}</p>
  </div>
</template>
