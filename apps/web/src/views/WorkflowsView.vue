<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { useTrialStatus } from '../composables/useTrialStatus'
import { useWorkflowTemplates } from '../composables/useWorkflowTemplates'
import type { WorkflowTemplateSummary } from '../composables/useWorkflowTemplates'
import ConfirmDialog from '../components/workflows/ConfirmDialog.vue'

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
const deleteTarget = ref<WorkflowTemplateSummary | null>(null)

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

async function confirmDelete() {
  if (isReadOnly.value || !deleteTarget.value) return
  await fetch(`/api/workflows/${deleteTarget.value.id}`, { method: 'DELETE' })
  deleteTarget.value = null
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
        class="flex items-center gap-2 whitespace-nowrap rounded-full bg-app-accent px-6 py-3.5 text-sm font-bold text-white disabled:opacity-50"
        @click="showForm = !showForm"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {{ t('workflows.list.newTemplateHeading') }}
      </button>
    </div>

    <div
      v-if="isReadOnly"
      class="mb-5.5 flex items-center gap-2.5 rounded-[14px] bg-app-warning-bg px-4 py-3 text-[13.5px] font-semibold text-app-warning"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        class="shrink-0"
      >
        <path
          d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.14A1 1 0 0 0 3 19.5h18a1 1 0 0 0 .89-1.5L13.71 3.86a1 1 0 0 0-1.72 0z"
        />
      </svg>
      {{ t('workflows.list.trialExpired') }}
    </div>

    <div v-if="showForm" class="mb-5.5 rounded-3xl bg-white p-7">
      <div class="mb-4 text-[15px] font-extrabold">
        {{ t('workflows.list.newTemplateHeading') }}
      </div>

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
          class="whitespace-nowrap rounded-lg bg-app-accent px-5.5 py-3 text-sm font-bold text-white disabled:opacity-60"
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
      <div
        v-for="template in templates"
        :key="template.id"
        class="rounded-[20px] bg-white p-5.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div class="mb-3.5 flex items-center justify-between">
          <span
            class="rounded-full px-3.5 py-1 text-[12.5px] font-bold"
            :class="
              template.type === 'onboarding'
                ? 'bg-app-surface text-app-ink-deep'
                : 'bg-app-surface-alt text-app-slate'
            "
          >
            {{ typeLabel(template.type) }}
          </span>
          <button
            type="button"
            :disabled="isReadOnly"
            class="flex h-7.5 w-7.5 items-center justify-center rounded-lg disabled:opacity-50"
            :aria-label="t('workflows.list.delete')"
            :title="t('workflows.list.delete')"
            @click.stop.prevent="deleteTarget = template"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              class="text-app-muted"
              stroke-width="2.2"
              stroke-linecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <RouterLink :to="`/workflows/${template.id}`">
          <h3 class="mb-2 truncate text-[16.5px] font-extrabold tracking-tight">
            {{ template.name }}
          </h3>
          <div class="flex items-center gap-2 text-[12.5px] font-semibold text-app-muted">
            <span>{{ t('common.phases', template.phaseCount) }}</span>
            <span class="h-0.75 w-0.75 shrink-0 rounded-full bg-app-border"></span>
            <span>{{ t('common.steps', template.stepCount) }}</span>
          </div>
        </RouterLink>
      </div>
    </div>

    <ConfirmDialog
      :open="deleteTarget !== null"
      :title="t('workflows.list.deleteConfirmTitle', { name: deleteTarget?.name ?? '' })"
      :body="
        t('workflows.list.deleteConfirmBody', {
          phases: t('common.phases', deleteTarget?.phaseCount ?? 0),
          steps: t('common.steps', deleteTarget?.stepCount ?? 0),
        })
      "
      :confirm-label="t('workflows.list.deleteConfirmSubmit')"
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </div>
</template>
