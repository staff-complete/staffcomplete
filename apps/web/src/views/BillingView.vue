<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TRIAL_LENGTH_DAYS } from '@staffcomplete/shared'
import { useTrialStatus } from '../composables/useTrialStatus'

const { t } = useI18n()
const { data: trialStatus } = useTrialStatus()
const trialProgressPct = computed(() => {
  if (!trialStatus.value) return 0
  return Math.round(
    ((TRIAL_LENGTH_DAYS - trialStatus.value.daysRemaining) / TRIAL_LENGTH_DAYS) * 100,
  )
})
</script>

<template>
  <div>
    <h1 class="mb-1.5 text-2xl font-extrabold tracking-tight">{{ t('billing.title') }}</h1>
    <p class="mb-6 text-[15px] text-app-slate">{{ t('billing.subtitle') }}</p>

    <div v-if="trialStatus && !trialStatus.isReadOnly" class="mb-5 rounded-3xl bg-app-surface p-8">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <div class="mb-2 text-xs font-bold uppercase tracking-wider text-app-ink-deep">
            {{ t('billing.trialLabel') }}
          </div>
          <div class="text-[26px] font-extrabold text-app-ink">
            {{ t('trialBanner.daysLeft', trialStatus.daysRemaining) }}
          </div>
        </div>
        <div
          class="flex h-15.5 w-15.5 shrink-0 items-center justify-center rounded-full border-[5px] border-app-ink/20"
        >
          <span class="text-sm font-extrabold text-app-ink">{{ trialProgressPct }}%</span>
        </div>
      </div>
    </div>

    <div class="rounded-3xl bg-white p-8 text-center">
      <h2 class="mb-2 text-lg font-bold">{{ t('billing.comingSoonTitle') }}</h2>
      <p class="text-sm text-app-muted">{{ t('billing.comingSoonBody') }}</p>
    </div>
  </div>
</template>
