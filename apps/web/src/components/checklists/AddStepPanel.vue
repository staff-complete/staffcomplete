<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { automatedActionKeys } from '@staffcomplete/shared'
import type { AutomatedActionKey } from '@staffcomplete/shared'
import type { Member, StepFormState } from '../../lib/stepForm'
import { actionConfigFields } from '../../composables/useActionConfigFields'

const props = withDefaults(
  defineProps<{
    members: Member[]
    error: string
    submitting: boolean
    isReadOnly: boolean
    automatedActionLabel: (key: AutomatedActionKey) => string
    mode?: 'create' | 'edit'
  }>(),
  { mode: 'create' },
)
const emit = defineEmits<{ submit: []; actionSelected: []; cancel: [] }>()

const form = defineModel<StepFormState>({ required: true })

const { t } = useI18n()

// In edit mode the panel is always shown (there's no collapsed dashed
// trigger to expand) — it's rendered next to the step being edited and
// unmounted by the parent when editing ends, rather than collapsing itself.
const expanded = ref(false)
const isOpen = computed(() => props.mode === 'edit' || expanded.value)

function open() {
  expanded.value = true
}
function close() {
  expanded.value = false
  emit('cancel')
}

function fieldModel(key: 'emailTo' | 'emailSubject' | 'emailBody') {
  return {
    get value() {
      return form.value[key]
    },
    set value(v: string) {
      form.value = { ...form.value, [key]: v }
    },
  }
}
</script>

<template>
  <div v-if="!isOpen" class="border-t border-app-surface-alt pt-4">
    <button
      type="button"
      :disabled="isReadOnly"
      class="flex w-full items-center justify-center gap-1.5 rounded-[10px] border-1.5 border-dashed border-app-border py-3 text-[13px] font-bold text-app-muted disabled:opacity-50"
      @click="open"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {{ t('checklists.editor.submit') }}
    </button>
  </div>

  <form
    v-else
    class="flex flex-col gap-3"
    :class="mode === 'create' ? 'border-t border-app-surface-alt pt-4' : ''"
    @submit.prevent="emit('submit')"
  >
    <div class="flex items-center justify-between">
      <span class="text-[13.5px] font-extrabold">{{
        mode === 'edit' ? t('checklists.editor.editStep') : t('checklists.editor.addStepHeading')
      }}</span>
      <button
        type="button"
        class="flex h-6.5 w-6.5 items-center justify-center rounded-md text-app-muted"
        @click="close"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.3"
          stroke-linecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="mode === 'create'" class="flex gap-2.5">
      <div
        class="flex flex-1 cursor-pointer items-center gap-2 rounded-[10px] border-1.5 p-2.5"
        :class="
          form.type === 'manual' ? 'border-app-accent bg-app-surface' : 'border-app-border bg-white'
        "
        @click="form = { ...form, type: 'manual' }"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.1"
          class="text-app-ink"
        >
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
        </svg>
        <span class="text-[13px] font-bold">{{ t('checklists.editor.typeManual') }}</span>
      </div>
      <div
        class="flex flex-1 cursor-pointer items-center gap-2 rounded-[10px] border-1.5 p-2.5"
        :class="
          form.type === 'automated'
            ? 'border-app-accent bg-app-surface'
            : 'border-app-border bg-white'
        "
        @click="form = { ...form, type: 'automated' }"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.1"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-app-accent"
        >
          <path d="M13 2 3 14h7l-1 8 11-14h-7z" />
        </svg>
        <span class="text-[13px] font-bold">{{ t('checklists.editor.typeAutomated') }}</span>
      </div>
    </div>
    <div v-else class="text-[12px] font-bold text-app-muted">
      {{
        form.type === 'manual'
          ? t('checklists.editor.typeManual')
          : t('checklists.editor.typeAutomated')
      }}
    </div>

    <div>
      <label class="mb-1.5 block text-[12px] font-bold text-app-slate" for="step-title">{{
        t('checklists.editor.titleLabel')
      }}</label>
      <input
        id="step-title"
        v-model="form.title"
        type="text"
        :placeholder="t('checklists.editor.titlePlaceholder')"
        class="w-full rounded-[9px] border border-app-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
      />
    </div>

    <template v-if="form.type === 'manual'">
      <div class="flex flex-wrap gap-2.5">
        <div class="min-w-[160px] flex-1">
          <label class="mb-1.5 block text-[12px] font-bold text-app-slate" for="step-assignee">{{
            t('checklists.editor.assigneeLabel')
          }}</label>
          <select
            id="step-assignee"
            v-model="form.assigneeId"
            class="w-full rounded-[9px] border border-app-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
          >
            <option value="">{{ t('common.unassigned') }}</option>
            <option v-for="member in members" :key="member.id" :value="member.id">
              {{ member.user.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-[12px] font-bold text-app-slate" for="step-due">{{
            t('checklists.editor.dueDaysLabel')
          }}</label>
          <input
            id="step-due"
            v-model="form.dueDateOffsetDays"
            type="number"
            min="0"
            placeholder="2"
            class="w-22 rounded-[9px] border border-app-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
          />
        </div>
      </div>
    </template>

    <template v-else>
      <div>
        <label class="mb-1.5 block text-[12px] font-bold text-app-slate" for="step-action">{{
          t('checklists.editor.actionLabel')
        }}</label>
        <select
          id="step-action"
          v-model="form.action"
          class="w-full rounded-[9px] border border-app-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
          @change="emit('actionSelected')"
        >
          <option value="" disabled>{{ t('checklists.editor.actionPlaceholder') }}</option>
          <option v-for="key in automatedActionKeys" :key="key" :value="key">
            {{ automatedActionLabel(key) }}
          </option>
        </select>
      </div>

      <div
        v-if="form.action && actionConfigFields[form.action]?.length"
        class="flex flex-col gap-2.5 rounded-[10px] p-3.5"
        :class="mode === 'edit' ? 'bg-white' : 'bg-app-bg'"
      >
        <div class="text-[11px] font-bold tracking-wide text-app-muted uppercase">
          {{ t('checklists.editor.actionConfigHeading') }}
        </div>
        <div v-for="field in actionConfigFields[form.action]" :key="field.key">
          <label
            class="mb-1.5 block text-[12px] font-bold text-app-slate"
            :for="`step-${field.key}`"
            >{{ t(field.labelKey) }}</label
          >
          <textarea
            v-if="field.type === 'textarea'"
            :id="`step-${field.key}`"
            v-model="fieldModel(field.key).value"
            rows="3"
            :placeholder="field.placeholderKey ? t(field.placeholderKey) : undefined"
            class="w-full resize-y rounded-[9px] border border-app-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
          />
          <input
            v-else
            :id="`step-${field.key}`"
            v-model="fieldModel(field.key).value"
            type="text"
            :placeholder="field.placeholderKey ? t(field.placeholderKey) : undefined"
            class="w-full rounded-[9px] border border-app-border bg-white px-3.5 py-2.5 text-[13.5px] outline-none"
          />
          <p v-if="field.hintKey" class="mt-1 text-[12px] text-app-muted">{{ t(field.hintKey) }}</p>
        </div>
      </div>
    </template>

    <p
      v-if="error"
      class="rounded-[10px] bg-app-danger-bg px-3.5 py-2.5 text-[13px] text-app-danger"
    >
      {{ error }}
    </p>

    <div class="mt-1 flex gap-2.5">
      <button
        type="submit"
        :disabled="submitting || isReadOnly"
        class="rounded-[9px] bg-app-accent px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
      >
        {{
          mode === 'edit'
            ? submitting
              ? t('checklists.editor.saving')
              : t('checklists.editor.save')
            : submitting
              ? t('checklists.editor.submitting')
              : t('checklists.editor.submit')
        }}
      </button>
      <button
        type="button"
        class="rounded-[9px] px-1.5 py-2.5 text-[13.5px] font-bold text-app-muted"
        @click="close"
      >
        {{ t('common.cancel') }}
      </button>
    </div>
  </form>
</template>
