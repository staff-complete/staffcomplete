<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRuns } from '../composables/useRuns'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

const { t } = useI18n()
const route = useRoute()
const type = computed(() => route.params.type as 'onboarding' | 'offboarding')
const typeLabel = computed(() =>
  type.value === 'offboarding' ? t('common.offboarding') : t('common.onboarding'),
)

const { data: runs, isLoading } = useRuns()
const completedRuns = computed(
  () => runs.value?.filter((r) => r.type === type.value && r.status === 'completed') ?? [],
)
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">
          {{ t('runs.history.title', { type: typeLabel }) }}
        </h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink
            :to="`/runs/${type}`"
            class="text-sm text-brand-teal font-medium hover:underline"
            >{{ t('runs.history.backToActive') }}</RouterLink
          >
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">
          {{ t('runs.history.completedHeading') }}
        </h2>

        <p v-if="isLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</p>
        <p v-else-if="completedRuns.length === 0" class="text-sm text-gray-500">
          {{ t('runs.history.empty') }}
        </p>
        <ul v-else class="divide-y divide-brand-border">
          <li v-for="r in completedRuns" :key="r.id" class="py-3">
            <RouterLink :to="`/runs/${type}/${r.id}`" class="block hover:opacity-80">
              <p class="text-sm font-medium text-brand-dark">{{ r.employeeName }}</p>
              <p class="text-xs text-gray-500">
                {{ r.type === 'offboarding' ? t('common.offboarding') : t('common.onboarding') }}
                ·
                {{
                  r.type === 'offboarding' ? t('runs.history.lastDay') : t('runs.history.started')
                }}
                {{ r.eventDate }} ·
                {{
                  t('common.ofStepsComplete', {
                    completed: r.completedStepCount,
                    total: r.stepCount,
                    steps: t('common.steps', r.stepCount),
                  })
                }}
              </p>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
