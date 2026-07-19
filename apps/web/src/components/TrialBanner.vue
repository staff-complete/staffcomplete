<script setup lang="ts">
import { computed } from 'vue'
import { useTrialStatus } from '../composables/useTrialStatus'
import { describeTrialBanner } from './trialBannerCopy'

const { data } = useTrialStatus()

const copy = computed(() => (data.value ? describeTrialBanner(data.value) : null))
</script>

<template>
  <div
    v-if="copy"
    class="rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4"
    :class="
      copy.variant === 'expired'
        ? 'bg-red-50 text-red-700 border border-red-200'
        : 'bg-brand-surface text-brand-dark border border-brand-border'
    "
  >
    <p>{{ copy.message }}</p>
    <RouterLink
      to="/billing"
      class="font-semibold whitespace-nowrap hover:underline"
      :class="copy.variant === 'expired' ? 'text-red-700' : 'text-brand-teal'"
    >
      Subscribe →
    </RouterLink>
  </div>
</template>
