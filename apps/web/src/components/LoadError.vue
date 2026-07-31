<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadErrorDetail } from '../lib/loadError'

const props = defineProps<{ error: unknown; retrying?: boolean }>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()

const detail = computed(() => loadErrorDetail(props.error, t('common.networkError')))
</script>

<template>
  <div role="alert" class="rounded-2xl bg-app-surface px-5 py-4.5">
    <p class="mb-1 text-sm font-bold text-app-danger">{{ t('common.loadFailed') }}</p>
    <p class="mb-3 text-[13px] text-app-slate">{{ detail }}</p>
    <button
      type="button"
      class="rounded-lg bg-white px-3.5 py-1.5 text-[13px] font-bold disabled:opacity-60"
      :disabled="retrying"
      @click="emit('retry')"
    >
      {{ retrying ? t('common.loading') : t('common.retry') }}
    </button>
  </div>
</template>
