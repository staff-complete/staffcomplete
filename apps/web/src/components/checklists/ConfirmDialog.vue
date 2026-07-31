<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-200 flex items-center justify-center bg-[#241f1a]/45 p-6"
    @click="emit('cancel')"
  >
    <div class="w-full max-w-[380px] rounded-[20px] bg-white p-6.5" @click.stop>
      <div class="mb-2 text-[17px] font-extrabold">{{ title }}</div>
      <p class="mb-5 text-[13.5px] text-app-muted">{{ body }}</p>
      <div class="flex justify-end gap-2.5">
        <button
          type="button"
          class="rounded-[10px] border border-app-border bg-white px-4.5 py-2.5 text-[13.5px] font-bold text-app-slate"
          @click="emit('cancel')"
        >
          {{ cancelLabel ?? t('common.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold text-white"
          :class="danger === false ? 'bg-app-accent' : 'bg-app-danger'"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
