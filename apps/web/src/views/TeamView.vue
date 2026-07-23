<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import { SUPPORTED_LOCALES, type Locale } from '@staffcomplete/shared'
import { useTrialStatus } from '../composables/useTrialStatus'
import { authClient } from '../lib/auth-client'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

type Invite = { id: string; email: string; role: string; expiresAt: string; createdAt: string }

const { t } = useI18n()

const { data: trialStatus } = useTrialStatus()
// UX only — the server-side source of truth is blockMutationsWhenExpired
// (apps/api/src/middleware/trial-lock.ts), which these same POST/DELETE
// requests hit regardless of what the button here allows.
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const invites = ref<Invite[]>([])
const loadingInvites = ref(true)

const form = ref({ email: '', role: 'member' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const successMessage = ref('')
const loading = ref(false)

const schema = computed(() =>
  z.object({
    email: z.string().email(t('team.validationEmail')),
    role: z.enum(['admin', 'member']),
  }),
)

async function loadInvites() {
  loadingInvites.value = true
  try {
    const res = await fetch('/api/invites')
    if (res.ok) {
      const data = (await res.json()) as { invites: Invite[] }
      invites.value = data.invites
    }
  } finally {
    loadingInvites.value = false
  }
}

onMounted(loadInvites)

async function submit() {
  if (isReadOnly.value) return

  errors.value = {}
  serverError.value = ''
  successMessage.value = ''

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      if (field === 'email') errors.value.email ||= issue.message
      if (field === 'role') errors.value.role ||= issue.message
    }
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (res.ok) {
      successMessage.value = t('team.successMessage', { email: form.value.email })
      form.value = { email: '', role: 'member' }
      await loadInvites()
      return
    }

    const data = (await res.json()) as { message?: string }
    if (res.status === 409) {
      errors.value.email = data.message ?? t('team.emailExists')
    } else {
      serverError.value = data.message ?? t('common.genericError')
    }
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    loading.value = false
  }
}

async function revoke(id: string) {
  if (isReadOnly.value) return

  await fetch(`/api/invites/${id}`, { method: 'DELETE' })
  await loadInvites()
}

const activeOrganization = authClient.useActiveOrganization()
const savingLocale = ref(false)
const localeMessage = ref('')
const localeError = ref('')

async function changeLocale(event: Event) {
  const locale = (event.target as HTMLSelectElement).value as Locale
  localeMessage.value = ''
  localeError.value = ''
  savingLocale.value = true
  try {
    const { error } = await authClient.organization.update({ data: { locale } })
    if (error) {
      localeError.value = t('team.languageError')
      return
    }
    localeMessage.value = t('team.languageSaved')
  } catch {
    localeError.value = t('team.languageError')
  } finally {
    savingLocale.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <TrialBanner />
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">{{ t('team.title') }}</h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink to="/dashboard" class="text-sm text-brand-teal font-medium hover:underline">{{
            t('common.backToDashboard')
          }}</RouterLink>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-1">{{ t('team.languageHeading') }}</h2>
        <p class="text-sm text-gray-500 mb-4">{{ t('team.languageDescription') }}</p>

        <select
          :value="activeOrganization.data?.locale"
          :disabled="savingLocale"
          class="px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
          @change="changeLocale"
        >
          <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
            {{ t(`locale.${loc}`) }}
          </option>
        </select>

        <p v-if="localeMessage" class="text-sm text-brand-teal mt-2">{{ localeMessage }}</p>
        <p v-if="localeError" class="text-sm text-red-500 mt-2">{{ localeError }}</p>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">{{ t('team.inviteHeading') }}</h2>

        <p v-if="isReadOnly" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {{ t('team.trialExpired') }}
        </p>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="email">{{
                t('team.emailLabel')
              }}</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                :placeholder="t('team.emailPlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.email
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.email" class="text-xs text-red-500 mt-1">{{ errors.email }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="role">{{
                t('team.roleLabel')
              }}</label>
              <select
                id="role"
                v-model="form.role"
                class="px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
              >
                <option value="member">{{ t('team.roleMember') }}</option>
                <option value="admin">{{ t('team.roleAdmin') }}</option>
              </select>
            </div>
          </div>

          <p
            v-if="successMessage"
            class="text-sm text-brand-teal bg-brand-surface rounded-lg px-3 py-2"
          >
            {{ successMessage }}
          </p>
          <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {{ serverError }}
          </p>

          <button
            type="submit"
            :disabled="loading || isReadOnly"
            class="bg-brand-teal text-white py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity"
            :class="loading || isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
          >
            {{ loading ? t('team.submitting') : t('team.submit') }}
          </button>
        </form>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">{{ t('team.pendingHeading') }}</h2>

        <p v-if="loadingInvites" class="text-sm text-gray-500">{{ t('common.loading') }}</p>
        <p v-else-if="invites.length === 0" class="text-sm text-gray-500">{{ t('team.empty') }}</p>
        <ul v-else class="divide-y divide-brand-border">
          <li
            v-for="invite in invites"
            :key="invite.id"
            class="flex items-center justify-between py-3"
          >
            <div>
              <p class="text-sm font-medium text-brand-dark">{{ invite.email }}</p>
              <p class="text-xs text-gray-500">
                {{ invite.role === 'admin' ? t('team.roleAdmin') : t('team.roleMember') }}
              </p>
            </div>
            <button
              type="button"
              :disabled="isReadOnly"
              class="text-sm text-red-500 font-medium"
              :class="isReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:underline'"
              @click="revoke(invite.id)"
            >
              {{ t('team.revoke') }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
