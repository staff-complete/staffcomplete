<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { AutomatedActionKey } from '@staffcomplete/shared'
import { authClient } from '../lib/auth-client'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplate } from '../composables/useWorkflowTemplates'
import type {
  WorkflowTemplatePhase,
  WorkflowTemplateStep,
} from '../composables/useWorkflowTemplates'
import { moveStep } from '../lib/reorderSteps'
import { emptyStepForm } from '../lib/stepForm'
import type { Member, StepFormState } from '../lib/stepForm'
import PhaseCard from '../components/workflows/PhaseCard.vue'
import PhaseFlowDiagram from '../components/workflows/PhaseFlowDiagram.vue'
import ConfirmDialog from '../components/workflows/ConfirmDialog.vue'

const { t } = useI18n()

// An action's label is fixed system vocabulary, not user-authored content —
// same class of string as typeManual/typeAutomated — so it's translated via
// i18n rather than shown as the English fallback stored in the shared
// registry (see packages/shared/src/automation.ts). Action keys use dots
// (e.g. 'email.send'), which map directly onto a nested i18n path.
function automatedActionLabel(key: AutomatedActionKey) {
  return t(`workflows.automatedActions.${key}`)
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

function stepMeta(step: WorkflowTemplateStep): string {
  if (step.type === 'manual') {
    let meta = `${t('workflows.editor.typeManual')} · ${memberLabel(step.assigneeId)}`
    if (step.dueDateOffsetDays !== null) {
      meta += ` ${t('workflows.editor.dueAfterStart', { days: step.dueDateOffsetDays })}`
    }
    return meta
  }
  return step.action
    ? `${t('workflows.editor.typeAutomated')} · ${automatedActionLabel(step.action)}`
    : t('workflows.editor.typeAutomated')
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

async function renamePhase(phaseId: string, newName: string) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id.value}/phases/${phaseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
  await invalidate()
}

async function deletePhase(phaseId: string) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id.value}/phases/${phaseId}`, { method: 'DELETE' })
  await invalidate()
}

// Replaces the full set of phases :phaseId depends on (ADR-0019) — PhaseCard
// already runs the same cycle check client-side before emitting, so this
// only round-trips to the server for the authoritative write.
async function setPhaseDependencies(phaseId: string, dependsOnPhaseIds: string[]) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id.value}/phases/${phaseId}/dependencies`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dependsOnPhaseIds }),
  })
  await invalidate()
}

const deletePhaseTarget = ref<WorkflowTemplatePhase | null>(null)
async function confirmDeletePhase() {
  if (!deletePhaseTarget.value) return
  await deletePhase(deletePhaseTarget.value.id)
  deletePhaseTarget.value = null
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

// Steps: one add-step form per phase, keyed by phaseId. PhaseCard's
// v-model:step-form binds directly to stepForms[phase.id], so every phase's
// entry must exist before it renders (unlike stepFormFor's old lazy-create,
// which only ran from inside an event handler after the template was
// already up).
const stepForms = reactive<Record<string, StepFormState>>({})
const stepErrors = reactive<Record<string, string>>({})
const addingStepPhaseId = ref<string | null>(null)

watch(
  template,
  (loadedTemplate) => {
    if (!loadedTemplate) return
    for (const phase of loadedTemplate.phases) {
      if (!stepForms[phase.id]) {
        stepForms[phase.id] = emptyStepForm()
      }
    }
  },
  { immediate: true },
)

function stepFormFor(phaseId: string) {
  if (!stepForms[phaseId]) {
    stepForms[phaseId] = emptyStepForm()
  }
  return stepForms[phaseId]
}

// Prefills the title from the action's label when an action is first picked
// — a nice default, since most steps just want the action's name — but
// never overwrites a title the admin already typed, since a template can
// have several steps using the same action (e.g. two "Send email" steps to
// different recipients) that need distinguishing.
function onActionSelected(phaseId: string) {
  const form = stepFormFor(phaseId)
  if (form.title.trim() === '' && form.action !== '') {
    form.title = automatedActionLabel(form.action)
  }
}

async function addStep(phaseId: string) {
  if (isReadOnly.value) return
  const form = stepFormFor(phaseId)
  stepErrors[phaseId] = ''

  if (form.title.trim().length < 2) {
    stepErrors[phaseId] = t('workflows.editor.validationTitle')
    return
  }
  if (form.type === 'automated' && form.action === '') {
    stepErrors[phaseId] = t('workflows.editor.validationAction')
    return
  }
  if (
    form.type === 'automated' &&
    form.action === 'email.send' &&
    (form.emailTo.trim() === '' || form.emailSubject.trim() === '' || form.emailBody.trim() === '')
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
          title: form.title,
          action: form.action,
          config: { to: form.emailTo, subject: form.emailSubject, body: form.emailBody },
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

function configString(config: unknown, key: string): string {
  if (config && typeof config === 'object' && key in config) {
    const value = (config as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : ''
  }
  return ''
}

const editingStepId = ref<string | null>(null)
const editStepForm = ref<StepFormState>(emptyStepForm())
const editStepError = ref('')
const editSubmitting = ref(false)

function startEditStep(step: WorkflowTemplateStep) {
  if (isReadOnly.value) return
  editingStepId.value = step.id
  editStepError.value = ''
  editStepForm.value = {
    title: step.title,
    type: step.type,
    assigneeId: step.assigneeId ?? '',
    dueDateOffsetDays: step.dueDateOffsetDays ?? '',
    action: step.action ?? '',
    emailTo: configString(step.config, 'to'),
    emailSubject: configString(step.config, 'subject'),
    emailBody: configString(step.config, 'body'),
  }
}

function cancelEditStep() {
  editingStepId.value = null
  editStepError.value = ''
}

function onEditActionSelected() {
  if (editStepForm.value.title.trim() === '' && editStepForm.value.action !== '') {
    editStepForm.value.title = automatedActionLabel(editStepForm.value.action)
  }
}

async function submitEditStep() {
  if (isReadOnly.value || !editingStepId.value) return
  const form = editStepForm.value
  editStepError.value = ''

  if (form.title.trim().length < 2) {
    editStepError.value = t('workflows.editor.validationTitle')
    return
  }
  if (form.type === 'automated' && form.action === '') {
    editStepError.value = t('workflows.editor.validationAction')
    return
  }
  if (
    form.type === 'automated' &&
    form.action === 'email.send' &&
    (form.emailTo.trim() === '' || form.emailSubject.trim() === '' || form.emailBody.trim() === '')
  ) {
    editStepError.value = t('workflows.editor.validationEmailConfig')
    return
  }

  const body =
    form.type === 'manual'
      ? {
          title: form.title,
          assigneeId: form.assigneeId || null,
          dueDateOffsetDays: form.dueDateOffsetDays !== '' ? Number(form.dueDateOffsetDays) : null,
        }
      : {
          title: form.title,
          action: form.action,
          config: { to: form.emailTo, subject: form.emailSubject, body: form.emailBody },
        }

  editSubmitting.value = true
  try {
    const res = await fetch(`/api/workflows/${id.value}/steps/${editingStepId.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      editingStepId.value = null
      await invalidate()
      return
    }

    const data = (await res.json()) as { message?: string }
    editStepError.value = data.message ?? t('common.genericError')
  } finally {
    editSubmitting.value = false
  }
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {{ t('workflows.editor.backToTemplates') }}
    </RouterLink>

    <p v-if="isLoading" class="text-sm text-app-muted">{{ t('common.loading') }}</p>

    <template v-else-if="template">
      <h1 class="mb-5 text-2xl font-extrabold tracking-tight">
        {{ template.name || t('workflows.editor.fallbackTitle') }}
      </h1>

      <div
        v-if="isReadOnly"
        class="mb-4.5 flex items-center gap-2.5 rounded-[14px] bg-app-warning-bg px-4 py-3 text-[13.5px] font-semibold text-app-warning"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          class="shrink-0"
        >
          <path
            d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.14A1 1 0 0 0 3 19.5h18a1 1 0 0 0 .89-1.5L13.71 3.86a1 1 0 0 0-1.72 0z"
          />
        </svg>
        {{ t('workflows.editor.trialExpired') }}
      </div>

      <div class="mb-4.5 rounded-[20px] bg-white p-5.5">
        <h2 class="mb-3.5 text-[15px] font-extrabold">
          {{ t('workflows.editor.detailsHeading') }}
        </h2>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="saveName">
          <div class="min-w-[200px] flex-1">
            <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="template-name">{{
              t('workflows.editor.nameLabel')
            }}</label>
            <input
              id="template-name"
              v-model="nameForm.name"
              type="text"
              :disabled="isReadOnly"
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
              :disabled="isReadOnly"
              class="rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
            >
              <option value="onboarding">{{ t('common.onboarding') }}</option>
              <option value="offboarding">{{ t('common.offboarding') }}</option>
            </select>
          </div>
          <button
            type="submit"
            :disabled="savingName || isReadOnly"
            class="whitespace-nowrap rounded-lg bg-app-accent px-5.5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {{ savingName ? t('workflows.editor.saving') : t('workflows.editor.save') }}
          </button>
        </form>
        <p v-if="nameError" class="mt-2 text-xs text-app-danger">{{ nameError }}</p>
      </div>

      <div class="mb-1.5">
        <h2 class="mb-1 text-[15px] font-extrabold">{{ t('workflows.editor.phasesHeading') }}</h2>
        <p class="mb-4 text-[13px] text-app-muted">{{ t('workflows.editor.parallelHint') }}</p>
      </div>

      <p v-if="template.phases.length === 0" class="mb-4 text-sm text-app-muted">
        {{ t('workflows.editor.noPhases') }}
      </p>

      <PhaseFlowDiagram :phases="template.phases" />

      <PhaseCard
        v-for="(phase, phaseIndex) in template.phases"
        :key="phase.id"
        :phase="phase"
        :all-phases="template.phases"
        :index="phaseIndex"
        :is-first="phaseIndex === 0"
        :is-last="phaseIndex === template.phases.length - 1"
        :is-read-only="isReadOnly"
        :members="members"
        v-model:step-form="stepForms[phase.id]"
        :step-error="stepErrors[phase.id] ?? ''"
        :submitting="addingStepPhaseId === phase.id"
        :editing-step-id="editingStepId"
        v-model:edit-step-form="editStepForm"
        :edit-step-error="editStepError"
        :edit-submitting="editSubmitting"
        :step-meta="stepMeta"
        :automated-action-label="automatedActionLabel"
        @rename-phase="renamePhase(phase.id, $event)"
        @move-up="reorderPhase(phase.id, 'up')"
        @move-down="reorderPhase(phase.id, 'down')"
        @delete-phase="deletePhaseTarget = phase"
        @set-dependencies="setPhaseDependencies(phase.id, $event)"
        @reorder-step="
          (stepId, direction) =>
            reorderStep(
              phase.id,
              phase.steps.map((s) => s.id),
              stepId,
              direction,
            )
        "
        @edit-step="startEditStep"
        @update-step="submitEditStep"
        @cancel-edit-step="cancelEditStep"
        @edit-action-selected="onEditActionSelected"
        @delete-step="deleteStep"
        @add-step="addStep(phase.id)"
        @action-selected="onActionSelected(phase.id)"
      />

      <div class="rounded-[20px] bg-white p-5.5">
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="addPhase">
          <div class="min-w-[200px] flex-1">
            <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="new-phase-name">{{
              t('workflows.editor.phaseNameLabel')
            }}</label>
            <input
              id="new-phase-name"
              v-model="newPhaseName"
              type="text"
              :disabled="isReadOnly"
              :placeholder="t('workflows.editor.phaseNamePlaceholder')"
              class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
            />
          </div>
          <button
            type="submit"
            :disabled="addingPhase || isReadOnly"
            class="whitespace-nowrap rounded-lg bg-app-accent px-5.5 py-3 text-sm font-bold text-white disabled:opacity-60"
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

      <ConfirmDialog
        :open="deletePhaseTarget !== null"
        :title="
          t('workflows.editor.deletePhaseConfirmTitle', { name: deletePhaseTarget?.name ?? '' })
        "
        :body="
          t('workflows.editor.deletePhaseConfirmBody', {
            steps: t('common.steps', deletePhaseTarget?.steps.length ?? 0),
          })
        "
        :confirm-label="t('workflows.editor.deletePhaseConfirmSubmit')"
        @cancel="deletePhaseTarget = null"
        @confirm="confirmDeletePhase"
      />
    </template>

    <p v-else class="text-sm text-app-muted">{{ t('workflows.editor.notFound') }}</p>
  </div>
</template>
