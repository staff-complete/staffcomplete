<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplates } from '../composables/useWorkflowTemplates'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

const { t } = useI18n()

const { data: trialStatus } = useTrialStatus()
// UX only — the server-side source of truth is blockMutationsWhenExpired
// (apps/api/src/middleware/trial-lock.ts), which these same POST/DELETE
// requests hit regardless of what the button here allows.
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const queryClient = useQueryClient()
const { data: templates, isLoading } = useWorkflowTemplates()

const form = ref({ name: '', type: 'onboarding' as 'onboarding' | 'offboarding' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const creating = ref(false)

function typeLabel(type: 'onboarding' | 'offboarding') {
  return type === 'offboarding' ? t('common.offboarding') : t('common.onboarding')
}

function invalidate() {
  return queryClient.invalidateQueries({ queryKey: ['workflow-templates'] })
}

async function createTemplate() {
  if (isReadOnly.value) return

  errors.value = {}
  serverError.value = ''

  if (form.value.name.trim().length < 2) {
    errors.value.name = t('workflows.list.validationName')
    return
  }

  creating.value = true
  try {
    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (res.ok) {
      form.value = { name: '', type: 'onboarding' }
      await invalidate()
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? t('common.genericError')
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    creating.value = false
  }
}

async function deleteTemplate(id: string) {
  if (isReadOnly.value) return
  await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
  await invalidate()
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">{{ t('workflows.list.title') }}</h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink to="/dashboard" class="text-sm text-brand-teal font-medium hover:underline">{{
            t('common.backToDashboard')
          }}</RouterLink>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">
          {{ t('workflows.list.newTemplateHeading') }}
        </h2>

        <p v-if="isReadOnly" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {{ t('workflows.list.trialExpired') }}
        </p>

        <form class="space-y-4" @submit.prevent="createTemplate">
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="name">{{
                t('workflows.list.nameLabel')
              }}</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                :placeholder="t('workflows.list.namePlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.name
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.name" class="text-xs text-red-500 mt-1">{{ errors.name }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="type">{{
                t('workflows.list.typeLabel')
              }}</label>
              <select
                id="type"
                v-model="form.type"
                class="px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
              >
                <option value="onboarding">{{ t('common.onboarding') }}</option>
                <option value="offboarding">{{ t('common.offboarding') }}</option>
              </select>
            </div>
          </div>

          <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {{ serverError }}
          </p>

          <button
            type="submit"
            :disabled="creating || isReadOnly"
            class="bg-brand-teal text-white py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity"
            :class="creating || isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
          >
            {{ creating ? t('workflows.list.submitting') : t('workflows.list.submit') }}
          </button>
        </form>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">
          {{ t('workflows.list.templatesHeading') }}
        </h2>

        <p v-if="isLoading" class="text-sm text-gray-500">{{ t('common.loading') }}</p>
        <p v-else-if="!templates || templates.length === 0" class="text-sm text-gray-500">
          {{ t('workflows.list.empty') }}
        </p>
        <ul v-else class="divide-y divide-brand-border">
          <li
            v-for="template in templates"
            :key="template.id"
            class="flex items-center justify-between py-3"
          >
            <RouterLink :to="`/workflows/${template.id}`" class="group">
              <p
                class="text-sm font-medium text-brand-dark group-hover:text-brand-teal group-hover:underline"
              >
                {{ template.name }}
              </p>
              <p class="text-xs text-gray-500">
                {{ typeLabel(template.type) }} · {{ t('common.steps', template.stepCount) }}
              </p>
            </RouterLink>
            <button
              type="button"
              :disabled="isReadOnly"
              class="text-sm text-red-500 font-medium"
              :class="isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:underline'"
              @click="deleteTemplate(template.id)"
            >
              {{ t('workflows.list.delete') }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
