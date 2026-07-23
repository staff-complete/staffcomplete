<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import type { WorkflowTemplateSummary } from '../composables/useWorkflowTemplates'

const props = defineProps<{ templates: WorkflowTemplateSummary[] }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()
const queryClient = useQueryClient()

const form = ref({
  workflowTemplateId: props.templates[0]?.id ?? '',
  employeeName: '',
  employeeEmail: '',
  employeeRole: '',
  eventDate: '',
})
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const submitting = ref(false)

const schema = computed(() =>
  z.object({
    workflowTemplateId: z.string().min(1, t('runs.startModal.validationTemplate')),
    employeeName: z.string().min(2, t('runs.startModal.validationName')),
    employeeEmail: z.string().email(t('runs.startModal.validationEmail')),
    employeeRole: z.string().min(1, t('runs.startModal.validationRole')),
    eventDate: z.string().min(1, t('runs.startModal.validationDate')),
  }),
)

async function submit() {
  errors.value = {}
  serverError.value = ''

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      errors.value[field] ||= issue.message
    }
    return
  }

  submitting.value = true
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (res.ok) {
      const created = (await res.json()) as { id: string }
      await queryClient.invalidateQueries({ queryKey: ['runs'] })
      emit('close')
      await router.push(`/runs/${created.id}`)
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? t('common.genericError')
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-200 flex items-center justify-center bg-[#241f1a]/45 p-6"
    @click="emit('close')"
  >
    <div
      class="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-[26px] bg-white p-8"
      @click.stop
    >
      <h2 class="mb-1.5 text-xl font-extrabold tracking-tight">{{ t('runs.startModal.title') }}</h2>
      <p class="mb-5.5 text-sm text-app-slate">{{ t('runs.startModal.subtitle') }}</p>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="template">{{
            t('runs.startModal.templateLabel')
          }}</label>
          <select
            id="template"
            v-model="form.workflowTemplateId"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          >
            <option value="" disabled>{{ t('runs.startModal.selectTemplate') }}</option>
            <option v-for="template in templates" :key="template.id" :value="template.id">
              {{ template.name }} ({{
                template.type === 'offboarding' ? t('common.offboarding') : t('common.onboarding')
              }})
            </option>
          </select>
          <p v-if="errors.workflowTemplateId" class="mt-1 text-xs text-app-danger">
            {{ errors.workflowTemplateId }}
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="employee-name">{{
            t('runs.startModal.nameLabel')
          }}</label>
          <input
            id="employee-name"
            v-model="form.employeeName"
            type="text"
            :placeholder="t('runs.startModal.namePlaceholder')"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <p v-if="errors.employeeName" class="mt-1 text-xs text-app-danger">
            {{ errors.employeeName }}
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="employee-email">{{
            t('runs.startModal.emailLabel')
          }}</label>
          <input
            id="employee-email"
            v-model="form.employeeEmail"
            type="email"
            :placeholder="t('runs.startModal.emailPlaceholder')"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <p v-if="errors.employeeEmail" class="mt-1 text-xs text-app-danger">
            {{ errors.employeeEmail }}
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="employee-role">{{
            t('runs.startModal.roleLabel')
          }}</label>
          <input
            id="employee-role"
            v-model="form.employeeRole"
            type="text"
            :placeholder="t('runs.startModal.rolePlaceholder')"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <p v-if="errors.employeeRole" class="mt-1 text-xs text-app-danger">
            {{ errors.employeeRole }}
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="event-date">{{
            t('runs.startModal.dateLabel')
          }}</label>
          <input
            id="event-date"
            v-model="form.eventDate"
            type="date"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <p v-if="errors.eventDate" class="mt-1 text-xs text-app-danger">{{ errors.eventDate }}</p>
        </div>

        <p
          v-if="serverError"
          class="rounded-xl bg-app-danger-bg px-3.5 py-2.5 text-[13px] text-app-danger"
        >
          {{ serverError }}
        </p>

        <div class="mt-1.5 flex gap-3">
          <button
            type="button"
            class="flex-1 rounded-xl bg-app-surface-alt py-3 text-center text-[14.5px] font-bold text-app-slate"
            @click="emit('close')"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="flex-1 rounded-full bg-app-accent py-3 text-center text-[14.5px] font-bold text-white"
            :class="submitting ? 'opacity-60' : ''"
          >
            {{ submitting ? t('runs.startModal.submitting') : t('runs.startModal.submit') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
