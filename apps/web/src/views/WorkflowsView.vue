<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplates } from '../composables/useWorkflowTemplates'

const { t } = useI18n()

const { data: trialStatus } = useTrialStatus()
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const queryClient = useQueryClient()
const { data: templates, isLoading } = useWorkflowTemplates()

const form = ref({ name: '', type: 'onboarding' as 'onboarding' | 'offboarding' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const creating = ref(false)
const showForm = ref(false)

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
      showForm.value = false
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
  <div>
    <div class="mb-5.5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="mb-1.5 text-2xl font-extrabold tracking-tight">
          {{ t('workflows.list.title') }}
        </h1>
        <p class="text-[15px] text-app-slate">{{ t('nav.templates') }}</p>
      </div>
      <button
        type="button"
        :disabled="isReadOnly"
        class="flex items-center gap-2 whitespace-nowrap rounded-full bg-app-accent px-6 py-3.5 text-sm font-bold text-white"
        :class="isReadOnly ? 'opacity-60' : ''"
        @click="showForm = !showForm"
      >
        {{ t('workflows.list.newTemplateHeading') }}
      </button>
    </div>

    <div v-if="showForm" class="mb-5.5 rounded-3xl bg-white p-7">
      <p
        v-if="isReadOnly"
        class="mb-4 rounded-xl bg-app-warning-bg px-3.5 py-2.5 text-sm text-app-warning"
      >
        {{ t('workflows.list.trialExpired') }}
      </p>

      <form class="flex flex-wrap items-end gap-3" @submit.prevent="createTemplate">
        <div class="min-w-[200px] flex-1">
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="name">{{
            t('workflows.list.nameLabel')
          }}</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            :placeholder="t('workflows.list.namePlaceholder')"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <p v-if="errors.name" class="mt-1 text-xs text-app-danger">{{ errors.name }}</p>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="type">{{
            t('workflows.list.typeLabel')
          }}</label>
          <select
            id="type"
            v-model="form.type"
            class="rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          >
            <option value="onboarding">{{ t('common.onboarding') }}</option>
            <option value="offboarding">{{ t('common.offboarding') }}</option>
          </select>
        </div>

        <button
          type="submit"
          :disabled="creating || isReadOnly"
          class="whitespace-nowrap rounded-full bg-app-accent px-6 py-3 text-sm font-bold text-white"
          :class="creating || isReadOnly ? 'opacity-60' : ''"
        >
          {{ creating ? t('workflows.list.submitting') : t('workflows.list.submit') }}
        </button>
      </form>
      <p
        v-if="serverError"
        class="mt-3 rounded-xl bg-app-danger-bg px-3.5 py-2.5 text-sm text-app-danger"
      >
        {{ serverError }}
      </p>
    </div>

    <p v-if="isLoading" class="text-sm text-app-muted">{{ t('common.loading') }}</p>
    <p v-else-if="!templates || templates.length === 0" class="text-sm text-app-muted">
      {{ t('workflows.list.empty') }}
    </p>
    <div v-else class="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="template in templates" :key="template.id" class="rounded-[22px] bg-white p-6.5">
        <div class="mb-4.5 flex items-center justify-between">
          <span
            class="rounded-full bg-app-surface px-3.5 py-1 text-[12.5px] font-bold text-app-ink"
          >
            {{ typeLabel(template.type) }}
          </span>
          <button
            type="button"
            :disabled="isReadOnly"
            class="text-sm font-bold text-app-danger"
            :class="isReadOnly ? 'opacity-60' : ''"
            @click="deleteTemplate(template.id)"
          >
            {{ t('workflows.list.delete') }}
          </button>
        </div>
        <RouterLink :to="`/workflows/${template.id}`">
          <h3 class="mb-2 text-[17.5px] font-extrabold tracking-tight">{{ template.name }}</h3>
          <div class="text-[13.5px] text-app-muted">
            {{ t('common.steps', template.stepCount) }}
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
