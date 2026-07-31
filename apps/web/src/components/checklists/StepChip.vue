<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { WorkflowTemplateStep } from '../../composables/useWorkflowTemplates'

const props = defineProps<{
  step: WorkflowTemplateStep
  meta: string
  isFirst: boolean
  isLast: boolean
  isReadOnly: boolean
}>()
const emit = defineEmits<{ moveUp: []; moveDown: []; edit: []; delete: [] }>()

const { t } = useI18n()

const AUTOMATED_ICON_PATH = 'M13 2 3 14h7l-1 8 11-14h-7z'
const MANUAL_ICON_PATH = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'

const isAutomated = () => props.step.type === 'automated'
</script>

<template>
  <div
    class="flex w-full cursor-pointer items-center gap-2.5 bg-app-bg/50 p-3 hover:bg-app-bg"
    role="button"
    tabindex="0"
    @click="emit('edit')"
    @keyup.enter="emit('edit')"
  >
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      class="shrink-0 text-app-border"
      aria-hidden="true"
      @click.stop
    >
      <circle cx="9" cy="6" r="1.1" fill="currentColor" />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" />
      <circle cx="9" cy="18" r="1.1" fill="currentColor" />
      <circle cx="15" cy="6" r="1.1" fill="currentColor" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" />
      <circle cx="15" cy="18" r="1.1" fill="currentColor" />
    </svg>

    <div
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
      :class="isAutomated() ? 'bg-app-surface' : 'bg-app-bg'"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.1"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="isAutomated() ? 'text-app-accent' : 'text-app-ink'"
      >
        <path :d="isAutomated() ? AUTOMATED_ICON_PATH : MANUAL_ICON_PATH" />
      </svg>
    </div>

    <div class="flex min-w-0 flex-1 items-baseline gap-2.5">
      <span class="truncate text-[13.5px] font-bold">{{ step.title }}</span>
      <span class="truncate text-[12px] text-app-muted">{{ meta }}</span>
    </div>

    <div class="flex shrink-0 items-center gap-0.5" @click.stop>
      <button
        type="button"
        :disabled="isReadOnly || isFirst"
        class="flex h-6 w-6 items-center justify-center rounded-md text-app-slate disabled:opacity-30"
        :aria-label="t('workflows.editor.moveUp')"
        @click="emit('moveUp')"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
      <button
        type="button"
        :disabled="isReadOnly || isLast"
        class="flex h-6 w-6 items-center justify-center rounded-md text-app-slate disabled:opacity-30"
        :aria-label="t('workflows.editor.moveDown')"
        @click="emit('moveDown')"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        :disabled="isReadOnly"
        class="flex h-6 w-6 items-center justify-center rounded-md text-app-slate disabled:opacity-30"
        :aria-label="t('workflows.editor.editStep')"
        :title="t('workflows.editor.editStep')"
        @click="emit('edit')"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
      <button
        type="button"
        :disabled="isReadOnly"
        class="flex h-6 w-6 items-center justify-center rounded-md disabled:opacity-30"
        :aria-label="t('workflows.editor.delete')"
        :title="t('workflows.editor.delete')"
        @click="emit('delete')"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          class="text-app-border"
          stroke-width="2.4"
          stroke-linecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
