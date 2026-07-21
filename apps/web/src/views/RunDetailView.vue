<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { authClient } from '../lib/auth-client'
import { useRunDetail } from '../composables/useRunDetail'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

type Member = { id: string; user: { name: string; email: string } }

const route = useRoute()
const type = computed(() => route.params.type as 'onboarding' | 'offboarding')
const id = computed(() => route.params.id as string)

const { data: run, isLoading } = useRunDetail(id.value)

const completedCount = computed(
  () => run.value?.steps.filter((s) => s.status === 'completed').length ?? 0,
)

const members = ref<Member[]>([])
onMounted(async () => {
  const { data } = await authClient.organization.listMembers()
  members.value = (data?.members ?? []) as Member[]
})

function memberLabel(memberId: string | null) {
  if (!memberId) return 'Unassigned'
  const member = members.value.find((m) => m.id === memberId)
  return member ? member.user.name : 'Unassigned'
}

function stepStatusLabel(step: { status: string; isOverdue: boolean }) {
  if (step.status === 'completed') return 'Completed'
  if (step.isOverdue) return 'Overdue'
  return 'Pending'
}

function stepStatusClass(step: { status: string; isOverdue: boolean }) {
  if (step.status === 'completed') return 'bg-green-50 text-green-700'
  if (step.isOverdue) return 'bg-red-50 text-red-600'
  return 'bg-gray-100 text-gray-600'
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">
          {{ run?.employeeName ?? 'Run' }}
        </h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink
            :to="`/runs/${type}`"
            class="text-sm text-brand-teal font-medium hover:underline"
            >← Back to runs</RouterLink
          >
        </div>
      </div>

      <p v-if="isLoading" class="text-sm text-gray-500">Loading…</p>

      <template v-else-if="run">
        <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
          <h2 class="text-lg font-semibold text-brand-dark mb-4">Details</h2>
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-gray-500">Type</dt>
              <dd class="text-brand-dark capitalize">{{ run.type }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Status</dt>
              <dd class="text-brand-dark capitalize">{{ run.status.replace('_', ' ') }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Email</dt>
              <dd class="text-brand-dark">{{ run.employeeEmail }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Role</dt>
              <dd class="text-brand-dark">{{ run.employeeRole }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">
                {{ run.type === 'offboarding' ? 'Last day' : 'Starts' }}
              </dt>
              <dd class="text-brand-dark">{{ run.eventDate }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Progress</dt>
              <dd class="text-brand-dark">
                {{ completedCount }} of {{ run.steps.length }}
                {{ run.steps.length === 1 ? 'step' : 'steps' }} complete
              </dd>
            </div>
          </dl>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
          <h2 class="text-lg font-semibold text-brand-dark mb-4">Steps</h2>

          <p v-if="run.steps.length === 0" class="text-sm text-gray-500">This run has no steps.</p>
          <ol v-else class="divide-y divide-brand-border">
            <li
              v-for="step in run.steps"
              :key="step.id"
              class="flex items-center justify-between py-3 gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-brand-dark truncate">{{ step.title }}</p>
                <p class="text-xs text-gray-500 capitalize">
                  {{ step.type }} · {{ memberLabel(step.assigneeId) }}
                  <template v-if="step.dueDate">· due {{ step.dueDate }}</template>
                </p>
              </div>
              <span
                class="shrink-0 text-xs font-semibold px-2 py-1 rounded-full"
                :class="stepStatusClass(step)"
                >{{ stepStatusLabel(step) }}</span
              >
            </li>
          </ol>
        </div>
      </template>

      <p v-else class="text-sm text-gray-500">Run not found.</p>
    </div>
  </div>
</template>
