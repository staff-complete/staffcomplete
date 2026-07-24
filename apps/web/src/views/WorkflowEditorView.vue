<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { automatedActionKeys } from '@staffcomplete/shared'
import type { AutomatedActionKey } from '@staffcomplete/shared'
import { authClient } from '../lib/auth-client'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplate } from '../composables/useWorkflowTemplates'
import type { WorkflowTemplateStep } from '../composables/useWorkflowTemplates'
import { moveStep } from '../lib/reorderSteps'

type Member = { id: string; user: { name: string; email: string } }

// Manual and automated steps collect genuinely different fields, but share
// one form/one add-step button per phase — see packages/shared/src/workflow.ts.
// emailSubject/emailBody are specific to the email.send_welcome action; a
// second registered action with different config would need its own fields
// here rather than reusing these.
interface StepFormState {
  title: string
  type: 'automated' | 'manual'
  assigneeId: string
  dueDateOffsetDays: string | number
  action: AutomatedActionKey | ''
  emailSubject: string
  emailBody: string
}

const { t } = useI18n()

// An action's label is fixed system vocabulary, not user-authored content —
// same class of string as typeManual/typeAutomated — so it's translated via
// i18n rather than shown as the English fallback stored in the shared
// registry (see packages/shared/src/automation.ts). Action keys use dots
// (e.g. 'email.send_welcome'), which map directly onto a nested i18n path.
function automatedActionLabel(key: AutomatedActionKey) {
  return t(`workflows.automatedActions.${key}`)
}

function stepDisplayTitle(step: WorkflowTemplateStep) {
  return step.type === 'automated' && step.action ? automatedActionLabel(step.action) : step.title
}
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

// Phases: ordered sequentially, steps within a phase run in parallel.
const phaseNameDrafts = reactive<Record<string, string>>({})
watch(
  template,
  (loadedTemplate) => {
    if (!loadedTemplate) return
    for (const phase of loadedTemplate.phases) {
      phaseNameDrafts[phase.id] = phase.name
    }
  },
  { immediate: true },
)

const newPhaseName = ref('')
const addingPhase = ref(false)
const phaseError = ref('')

async function addPhase() {
  if (isReadOnly.value) return
  phaseError.value = ''
  if (newPhaseName.value.trim().length < 2) {
    phaseError.value = t('workflows.editor.validationName')
    return
  }
  addingPhase.value = true
  try {
    const res = await fetch(`/api/workflows/${id.value}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPhaseName.value }),
    })
    if (res.ok) {
      newPhaseName.value = ''
      await invalidate()
      return
    }
    const data = (await res.json()) as { message?: string }
    phaseError.value = data.message ?? t('common.genericError')
  } finally {
    addingPhase.value = false
  }
}

async function renamePhase(phaseId: string, currentName: string) {
  if (isReadOnly.value) return
  const draft = phaseNameDrafts[phaseId]?.trim() ?? ''
  if (draft.length < 2 || draft === currentName) {
    phaseNameDrafts[phaseId] = currentName
    return
  }
  await fetch(`/api/workflows/${id.value}/phases/${phaseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: draft }),
  })
  await invalidate()
}

async function deletePhase(phaseId: string) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id.value}/phases/${phaseId}`, { method: 'DELETE' })
  await invalidate()
}

async function reorderPhase(phaseId: string, direction: 'up' | 'down') {
  if (isReadOnly.value || !template.value) return
  const currentIds = template.value.phases.map((p) => p.id)
  const nextIds = moveStep(currentIds, phaseId, direction)
  if (nextIds === currentIds) return

  await fetch(`/api/workflows/${id.value}/phase-order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phaseIds: nextIds }),
  })
  await invalidate()
}

// Steps: one add-step form per phase, keyed by phaseId.
const stepForms = reactive<Record<string, StepFormState>>({})
const stepErrors = reactive<Record<string, string>>({})
const addingStepPhaseId = ref<string | null>(null)

function emptyStepForm(): StepFormState {
  return {
    title: '',
    type: 'manual',
    assigneeId: '',
    dueDateOffsetDays: '',
    action: '',
    emailSubject: '',
    emailBody: '',
  }
}

function stepFormFor(phaseId: string): StepFormState {
  if (!stepForms[phaseId]) {
    stepForms[phaseId] = emptyStepForm()
  }
  return stepForms[phaseId]
}

async function addStep(phaseId: string) {
  if (isReadOnly.value) return
  const form = stepFormFor(phaseId)
  stepErrors[phaseId] = ''

  if (form.type === 'manual' && form.title.trim().length < 2) {
    stepErrors[phaseId] = t('workflows.editor.validationTitle')
    return
  }
  if (form.type === 'automated' && form.action === '') {
    stepErrors[phaseId] = t('workflows.editor.validationAction')
    return
  }
  if (
    form.type === 'automated' &&
    form.action === 'email.send_welcome' &&
    (form.emailSubject.trim() === '' || form.emailBody.trim() === '')
  ) {
    stepErrors[phaseId] = t('workflows.editor.validationEmailConfig')
    return
  }

  const body =
    form.type === 'manual'
      ? {
          phaseId,
          type: 'manual' as const,
          title: form.title,
          assigneeId: form.assigneeId || null,
          dueDateOffsetDays: form.dueDateOffsetDays !== '' ? Number(form.dueDateOffsetDays) : null,
        }
      : {
          phaseId,
          type: 'automated' as const,
          action: form.action,
          config: { subject: form.emailSubject, body: form.emailBody },
        }

  addingStepPhaseId.value = phaseId
  try {
    const res = await fetch(`/api/workflows/${id.value}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      stepForms[phaseId] = emptyStepForm()
      await invalidate()
      return
    }

    const data = (await res.json()) as { message?: string }
    stepErrors[phaseId] = data.message ?? t('common.genericError')
  } finally {
    addingStepPhaseId.value = null
  }
}

async function deleteStep(stepId: string) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id.value}/steps/${stepId}`, { method: 'DELETE' })
  await invalidate()
}

async function reorderStep(
  phaseId: string,
  stepIds: string[],
  stepId: string,
  direction: 'up' | 'down',
) {
  if (isReadOnly.value) return
  const nextIds = moveStep(stepIds, stepId, direction)
  if (nextIds === stepIds) return

  await fetch(`/api/workflows/${id.value}/phases/${phaseId}/steps/order`, {
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

      <div class="mb-5">
        <h2 class="mb-1 text-lg font-extrabold">{{ t('workflows.editor.phasesHeading') }}</h2>
        <p class="mb-4 text-[13px] text-app-muted">{{ t('workflows.editor.parallelHint') }}</p>

        <p v-if="template.phases.length === 0" class="mb-4 text-sm text-app-muted">
          {{ t('workflows.editor.noPhases') }}
        </p>

        <div
          v-for="(phase, phaseIndex) in template.phases"
          :key="phase.id"
          class="mb-4 rounded-3xl bg-white p-7"
        >
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <input
              v-model="phaseNameDrafts[phase.id]"
              type="text"
              :disabled="isReadOnly"
              class="min-w-[160px] flex-1 rounded-xl border border-app-border px-4 py-2.5 text-[15.5px] font-extrabold outline-none"
              @blur="renamePhase(phase.id, phase.name)"
            />
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                :disabled="isReadOnly || phaseIndex === 0"
                class="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-app-ink disabled:opacity-30"
                :aria-label="t('workflows.editor.movePhaseUp')"
                @click="reorderPhase(phase.id, 'up')"
              >
                ↑
              </button>
              <button
                type="button"
                :disabled="isReadOnly || phaseIndex === template.phases.length - 1"
                class="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-app-ink disabled:opacity-30"
                :aria-label="t('workflows.editor.movePhaseDown')"
                @click="reorderPhase(phase.id, 'down')"
              >
                ↓
              </button>
              <button
                type="button"
                :disabled="isReadOnly"
                class="text-sm font-bold text-app-danger"
                :class="isReadOnly ? 'opacity-60' : ''"
                @click="deletePhase(phase.id)"
              >
                {{ t('workflows.editor.deletePhase') }}
              </button>
            </div>
          </div>

          <p v-if="phase.steps.length === 0" class="mb-4 text-sm text-app-muted">
            {{ t('workflows.editor.noSteps') }}
          </p>
          <ol v-else class="mb-6 flex flex-col">
            <li
              v-for="(step, stepIndex) in phase.steps"
              :key="step.id"
              class="flex items-center justify-between gap-3 border-b border-app-surface-alt py-4 last:border-0"
            >
              <div class="min-w-0">
                <p class="truncate text-[15.5px] font-bold">{{ stepDisplayTitle(step) }}</p>
                <p class="mt-0.5 text-[13px] text-app-muted">
                  {{
                    step.type === 'manual'
                      ? t('workflows.editor.typeManual')
                      : t('workflows.editor.typeAutomated')
                  }}
                  <template v-if="step.type === 'manual'">
                    · {{ memberLabel(step.assigneeId) }}
                    <template v-if="step.dueDateOffsetDays !== null">
                      {{ t('workflows.editor.dueAfterStart', { days: step.dueDateOffsetDays }) }}
                    </template>
                  </template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  :disabled="isReadOnly || stepIndex === 0"
                  class="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-app-ink disabled:opacity-30"
                  :aria-label="t('workflows.editor.moveUp')"
                  @click="
                    reorderStep(
                      phase.id,
                      phase.steps.map((s) => s.id),
                      step.id,
                      'up',
                    )
                  "
                >
                  ↑
                </button>
                <button
                  type="button"
                  :disabled="isReadOnly || stepIndex === phase.steps.length - 1"
                  class="flex h-8.5 w-8.5 items-center justify-center rounded-lg text-app-ink disabled:opacity-30"
                  :aria-label="t('workflows.editor.moveDown')"
                  @click="
                    reorderStep(
                      phase.id,
                      phase.steps.map((s) => s.id),
                      step.id,
                      'down',
                    )
                  "
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
            @submit.prevent="addStep(phase.id)"
          >
            <h3 class="text-sm font-extrabold">{{ t('workflows.editor.addStepHeading') }}</h3>

            <div>
              <label
                class="mb-1.5 block text-[13px] font-bold text-app-slate"
                :for="`step-type-${phase.id}`"
                >{{ t('workflows.editor.typeLabel') }}</label
              >
              <select
                :id="`step-type-${phase.id}`"
                v-model="stepFormFor(phase.id).type"
                class="rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
              >
                <option value="manual">{{ t('workflows.editor.typeManual') }}</option>
                <option value="automated">{{ t('workflows.editor.typeAutomated') }}</option>
              </select>
            </div>

            <template v-if="stepFormFor(phase.id).type === 'manual'">
              <div>
                <label
                  class="mb-1.5 block text-[13px] font-bold text-app-slate"
                  :for="`step-title-${phase.id}`"
                  >{{ t('workflows.editor.titleLabel') }}</label
                >
                <input
                  :id="`step-title-${phase.id}`"
                  v-model="stepFormFor(phase.id).title"
                  type="text"
                  :placeholder="t('workflows.editor.titlePlaceholder')"
                  class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
                />
              </div>

              <div class="flex flex-wrap gap-3">
                <div class="min-w-[180px] flex-1">
                  <label
                    class="mb-1.5 block text-[13px] font-bold text-app-slate"
                    :for="`step-assignee-${phase.id}`"
                    >{{ t('workflows.editor.assigneeLabel') }}</label
                  >
                  <select
                    :id="`step-assignee-${phase.id}`"
                    v-model="stepFormFor(phase.id).assigneeId"
                    class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
                  >
                    <option value="">{{ t('common.unassigned') }}</option>
                    <option v-for="member in members" :key="member.id" :value="member.id">
                      {{ member.user.name }}
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    class="mb-1.5 block text-[13px] font-bold text-app-slate"
                    :for="`step-due-${phase.id}`"
                    >{{ t('workflows.editor.dueDaysLabel') }}</label
                  >
                  <input
                    :id="`step-due-${phase.id}`"
                    v-model="stepFormFor(phase.id).dueDateOffsetDays"
                    type="number"
                    min="0"
                    placeholder="2"
                    class="w-24 rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
                  />
                </div>
              </div>
            </template>

            <template v-else>
              <div class="min-w-[220px]">
                <label
                  class="mb-1.5 block text-[13px] font-bold text-app-slate"
                  :for="`step-action-${phase.id}`"
                  >{{ t('workflows.editor.actionLabel') }}</label
                >
                <select
                  :id="`step-action-${phase.id}`"
                  v-model="stepFormFor(phase.id).action"
                  class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
                >
                  <option value="" disabled>{{ t('workflows.editor.actionPlaceholder') }}</option>
                  <option v-for="key in automatedActionKeys" :key="key" :value="key">
                    {{ automatedActionLabel(key) }}
                  </option>
                </select>
              </div>

              <template v-if="stepFormFor(phase.id).action === 'email.send_welcome'">
                <div>
                  <label
                    class="mb-1.5 block text-[13px] font-bold text-app-slate"
                    :for="`step-email-subject-${phase.id}`"
                    >{{ t('workflows.editor.emailSubjectLabel') }}</label
                  >
                  <input
                    :id="`step-email-subject-${phase.id}`"
                    v-model="stepFormFor(phase.id).emailSubject"
                    type="text"
                    class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
                  />
                </div>
                <div>
                  <label
                    class="mb-1.5 block text-[13px] font-bold text-app-slate"
                    :for="`step-email-body-${phase.id}`"
                    >{{ t('workflows.editor.emailBodyLabel') }}</label
                  >
                  <textarea
                    :id="`step-email-body-${phase.id}`"
                    v-model="stepFormFor(phase.id).emailBody"
                    rows="4"
                    :placeholder="t('workflows.editor.emailBodyPlaceholder')"
                    class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
                  />
                  <p class="mt-1 text-[12px] text-app-muted">
                    {{ t('workflows.editor.emailBodyHint') }}
                  </p>
                </div>
              </template>
            </template>

            <p
              v-if="stepErrors[phase.id]"
              class="rounded-xl bg-app-danger-bg px-3.5 py-2.5 text-sm text-app-danger"
            >
              {{ stepErrors[phase.id] }}
            </p>

            <button
              type="submit"
              :disabled="addingStepPhaseId === phase.id || isReadOnly"
              class="w-fit whitespace-nowrap rounded-full bg-app-accent px-6 py-3 text-sm font-bold text-white"
              :class="addingStepPhaseId === phase.id || isReadOnly ? 'opacity-60' : ''"
            >
              {{
                addingStepPhaseId === phase.id
                  ? t('workflows.editor.submitting')
                  : t('workflows.editor.submit')
              }}
            </button>
          </form>
        </div>

        <div class="rounded-3xl bg-white p-7">
          <form class="flex flex-wrap items-end gap-3" @submit.prevent="addPhase">
            <div class="min-w-[200px] flex-1">
              <label
                class="mb-1.5 block text-[13px] font-bold text-app-slate"
                for="new-phase-name"
                >{{ t('workflows.editor.phaseNameLabel') }}</label
              >
              <input
                id="new-phase-name"
                v-model="newPhaseName"
                type="text"
                :placeholder="t('workflows.editor.phaseNamePlaceholder')"
                class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
              />
            </div>
            <button
              type="submit"
              :disabled="addingPhase || isReadOnly"
              class="whitespace-nowrap rounded-full bg-app-accent px-6 py-3 text-sm font-bold text-white"
              :class="addingPhase || isReadOnly ? 'opacity-60' : ''"
            >
              {{
                addingPhase
                  ? t('workflows.editor.addPhaseSubmitting')
                  : t('workflows.editor.addPhaseSubmit')
              }}
            </button>
          </form>
          <p v-if="phaseError" class="mt-2 text-xs text-app-danger">{{ phaseError }}</p>
        </div>
      </div>
    </template>

    <p v-else class="text-sm text-app-muted">{{ t('workflows.editor.notFound') }}</p>
  </div>
</template>
