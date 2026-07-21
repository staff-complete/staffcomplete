<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRuns } from '../composables/useRuns'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

const route = useRoute()
const type = computed(() => route.params.type as 'onboarding' | 'offboarding')

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
        <h1 class="text-2xl font-bold text-brand-dark capitalize">{{ type }} run history</h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink
            :to="`/runs/${type}`"
            class="text-sm text-brand-teal font-medium hover:underline"
            >← Back to active runs</RouterLink
          >
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">Completed runs</h2>

        <p v-if="isLoading" class="text-sm text-gray-500">Loading…</p>
        <p v-else-if="completedRuns.length === 0" class="text-sm text-gray-500">
          No completed runs yet.
        </p>
        <ul v-else class="divide-y divide-brand-border">
          <li v-for="r in completedRuns" :key="r.id" class="py-3">
            <RouterLink :to="`/runs/${type}/${r.id}`" class="block hover:opacity-80">
              <p class="text-sm font-medium text-brand-dark">{{ r.employeeName }}</p>
              <p class="text-xs text-gray-500 capitalize">
                {{ r.type }} · {{ r.type === 'offboarding' ? 'last day' : 'started' }}
                {{ r.eventDate }} · {{ r.completedStepCount }} of {{ r.stepCount }}
                {{ r.stepCount === 1 ? 'step' : 'steps' }} complete
              </p>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
