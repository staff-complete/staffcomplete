<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AutomatedActionKey, PhaseDependencyEdge } from '@staffcomplete/shared'
import { wouldCreateCycle } from '@staffcomplete/shared'
import type {
  ChecklistTemplatePhase,
  ChecklistTemplateStep,
} from '../../composables/useChecklistTemplates'
import type { Member, StepFormState } from '../../lib/stepForm'
import StepChip from './StepChip.vue'
import AddStepPanel from './AddStepPanel.vue'

const props = defineProps<{
  phase: ChecklistTemplatePhase
  allPhases: ChecklistTemplatePhase[]
  index: number
  isFirst: boolean
  isLast: boolean
  isReadOnly: boolean
  members: Member[]
  stepError: string
  submitting: boolean
  editingStepId: string | null
  editStepError: string
  editSubmitting: boolean
  stepMeta: (step: ChecklistTemplateStep) => string
  automatedActionLabel: (key: AutomatedActionKey) => string
}>()
const emit = defineEmits<{
  renamePhase: [name: string]
  moveUp: []
  moveDown: []
  deletePhase: []
  setDependencies: [dependsOnPhaseIds: string[]]
  reorderStep: [stepId: string, direction: 'up' | 'down']
  editStep: [step: ChecklistTemplateStep]
  updateStep: []
  cancelEditStep: []
  deleteStep: [stepId: string]
  addStep: []
  actionSelected: []
  editActionSelected: []
}>()

const stepForm = defineModel<StepFormState>('stepForm', { required: true })
const editStepForm = defineModel<StepFormState>('editStepForm', { required: true })

const { t } = useI18n()

// Every other phase in the template is a candidate dependency. Excludes
// this phase's own current edges from the cycle check (this control is
// about to replace them), same "replace the full set" semantics as the
// PUT .../dependencies endpoint it feeds — see ADR-0019.
const otherPhases = computed(() => props.allPhases.filter((p) => p.id !== props.phase.id))
const edgesExcludingSelf = computed<PhaseDependencyEdge[]>(() =>
  props.allPhases.flatMap((p) =>
    p.id === props.phase.id
      ? []
      : p.dependsOnPhaseIds.map((dependsOnPhaseId) => ({ phaseId: p.id, dependsOnPhaseId })),
  ),
)
function isDependencyChecked(candidateId: string): boolean {
  return props.phase.dependsOnPhaseIds.includes(candidateId)
}
function isDependencyDisabled(candidateId: string): boolean {
  return (
    !isDependencyChecked(candidateId) &&
    wouldCreateCycle(edgesExcludingSelf.value, props.phase.id, candidateId)
  )
}
function toggleDependency(candidateId: string) {
  if (props.isReadOnly || isDependencyDisabled(candidateId)) return
  const next = isDependencyChecked(candidateId)
    ? props.phase.dependsOnPhaseIds.filter((id) => id !== candidateId)
    : [...props.phase.dependsOnPhaseIds, candidateId]
  emit('setDependencies', next)
}

const editing = ref(false)
const draft = ref('')
const justSaved = ref(false)

function startEdit(currentName: string) {
  if (editing.value) return
  draft.value = currentName
  editing.value = true
}
function cancelEdit() {
  editing.value = false
}
function saveEdit(currentName: string) {
  const trimmed = draft.value.trim()
  editing.value = false
  if (trimmed.length < 2 || trimmed === currentName) return
  emit('renamePhase', trimmed)
  justSaved.value = true
  setTimeout(() => {
    justSaved.value = false
  }, 1400)
}
</script>

<template>
  <div class="flex items-start gap-3.5">
    <div class="flex shrink-0 flex-col items-center pt-5.5">
      <div
        class="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-app-ink text-[13px] font-extrabold text-white"
      >
        {{ index + 1 }}
      </div>
      <div v-if="!isLast" class="min-h-6 w-0.5 flex-1 bg-app-border"></div>
    </div>

    <div class="mb-5.5 min-w-0 flex-1 rounded-[20px] bg-white p-5.5">
      <div class="mb-1 flex flex-wrap items-center gap-2.5">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          class="shrink-0 text-app-border"
          aria-hidden="true"
        >
          <circle cx="9" cy="6" r="1.2" fill="currentColor" />
          <circle cx="9" cy="12" r="1.2" fill="currentColor" />
          <circle cx="9" cy="18" r="1.2" fill="currentColor" />
          <circle cx="15" cy="6" r="1.2" fill="currentColor" />
          <circle cx="15" cy="12" r="1.2" fill="currentColor" />
          <circle cx="15" cy="18" r="1.2" fill="currentColor" />
        </svg>

        <template v-if="editing">
          <input
            v-model="draft"
            type="text"
            autofocus
            class="min-w-[140px] flex-1 rounded-[9px] border-1.5 border-app-accent px-3 py-2 text-[15px] font-extrabold outline-none"
            @keyup.enter="saveEdit(phase.name)"
            @keyup.escape="cancelEdit"
          />
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface"
            :aria-label="t('checklists.editor.savePhaseName')"
            @click="saveEdit(phase.name)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="text-app-accent"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            :aria-label="t('checklists.editor.cancelEditPhaseName')"
            @click="cancelEdit"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="text-app-muted"
              stroke-width="2.4"
              stroke-linecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </template>
        <div
          v-else
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5"
          role="button"
          tabindex="0"
          :aria-label="t('checklists.editor.editPhaseName')"
          @click="startEdit(phase.name)"
          @keyup.enter="startEdit(phase.name)"
        >
          <span class="truncate text-[15.5px] font-extrabold">{{ phase.name }}</span>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            class="shrink-0 text-app-border"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </div>

        <span v-if="justSaved" class="shrink-0 text-[12px] font-bold text-app-accent">{{
          t('checklists.editor.savedBadge')
        }}</span>

        <div class="flex-1"></div>

        <button
          type="button"
          :disabled="isReadOnly || isFirst"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-slate disabled:opacity-30"
          :aria-label="t('checklists.editor.movePhaseUp')"
          @click="emit('moveUp')"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          :disabled="isReadOnly || isLast"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-slate disabled:opacity-30"
          :aria-label="t('checklists.editor.movePhaseDown')"
          @click="emit('moveDown')"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          :disabled="isReadOnly"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-30"
          :aria-label="t('checklists.editor.deletePhase')"
          @click="emit('deletePhase')"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            class="text-app-danger"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="mb-4.5">
        <p class="mb-2 text-[12px] font-bold tracking-wide text-app-muted uppercase">
          {{ t('checklists.editor.dependsOnLabel') }}
        </p>
        <p v-if="otherPhases.length === 0" class="text-[13px] text-app-muted">
          {{ t('checklists.editor.dependsOnNoOtherPhases') }}
        </p>
        <template v-else>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="candidate in otherPhases"
              :key="candidate.id"
              class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px]"
              :class="[
                isDependencyChecked(candidate.id)
                  ? 'border-app-accent bg-app-accent/10 font-bold'
                  : 'border-app-border',
                (isReadOnly || isDependencyDisabled(candidate.id)) &&
                  !isDependencyChecked(candidate.id) &&
                  'opacity-40',
              ]"
              :title="
                isDependencyDisabled(candidate.id)
                  ? t('checklists.editor.dependsOnCycleDisabledHint')
                  : undefined
              "
            >
              <input
                type="checkbox"
                :checked="isDependencyChecked(candidate.id)"
                :disabled="isReadOnly || isDependencyDisabled(candidate.id)"
                @change="toggleDependency(candidate.id)"
              />
              {{ candidate.name }}
            </label>
          </div>
          <p v-if="phase.dependsOnPhaseIds.length === 0" class="mt-1.5 text-[12px] text-app-muted">
            {{ t('checklists.editor.dependsOnRootHint') }}
          </p>
        </template>
      </div>

      <template v-if="phase.steps.length > 0">
        <div class="mb-3 flex items-center gap-1.5 ps-0.5">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            class="text-app-muted"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <path d="M8 6v12M16 6v12" />
          </svg>
          <span class="text-[12px] font-bold tracking-wide text-app-muted uppercase">{{
            t('checklists.editor.runsInParallelLabel')
          }}</span>
        </div>
        <div
          class="mb-4 flex flex-col overflow-hidden rounded-[14px] border border-app-surface-alt"
        >
          <template v-for="(step, stepIndex) in phase.steps" :key="step.id">
            <div
              v-if="step.id === editingStepId"
              class="border-b border-app-surface-alt bg-app-bg p-4 last:border-b-0"
            >
              <AddStepPanel
                v-model="editStepForm"
                mode="edit"
                :members="members"
                :error="editStepError"
                :submitting="editSubmitting"
                :is-read-only="isReadOnly"
                :automated-action-label="automatedActionLabel"
                @submit="emit('updateStep')"
                @action-selected="emit('editActionSelected')"
                @cancel="emit('cancelEditStep')"
              />
            </div>
            <StepChip
              v-else
              :step="step"
              :meta="stepMeta(step)"
              :is-first="stepIndex === 0"
              :is-last="stepIndex === phase.steps.length - 1"
              :is-read-only="isReadOnly"
              class="border-b border-app-surface-alt last:border-b-0"
              @move-up="emit('reorderStep', step.id, 'up')"
              @move-down="emit('reorderStep', step.id, 'down')"
              @edit="emit('editStep', step)"
              @delete="emit('deleteStep', step.id)"
            />
          </template>
        </div>
      </template>
      <p v-else class="mb-4 text-[13.5px] text-app-muted">{{ t('checklists.editor.noSteps') }}</p>

      <AddStepPanel
        v-model="stepForm"
        :members="members"
        :error="stepError"
        :submitting="submitting"
        :is-read-only="isReadOnly"
        :automated-action-label="automatedActionLabel"
        @submit="emit('addStep')"
        @action-selected="emit('actionSelected')"
      />
    </div>
  </div>
</template>
