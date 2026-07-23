<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import { authClient } from '../lib/auth-client'
import { useTrialStatus } from '../composables/useTrialStatus'
import { avatarColorsFor, initialsFor } from '../lib/avatarColors'

type Invite = { id: string; email: string; role: string; expiresAt: string; createdAt: string }
type Member = { id: string; role: string; user: { name: string; email: string } }

const { t } = useI18n()

const { data: trialStatus } = useTrialStatus()
const isReadOnly = computed(() => trialStatus.value?.isReadOnly ?? false)

const invites = ref<Invite[]>([])
const loadingInvites = ref(true)
const members = ref<Member[]>([])

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

async function loadMembers() {
  const { data } = await authClient.organization.listMembers()
  members.value = (data?.members ?? []) as Member[]
}

onMounted(() => {
  void loadInvites()
  void loadMembers()
})

function roleLabel(role: string) {
  if (role === 'owner') return t('team.roleOwner')
  if (role === 'admin') return t('team.roleAdmin')
  return t('team.roleMember')
}

const decoratedMembers = computed(() =>
  members.value.map((m) => {
    const colors = avatarColorsFor(m.user.name)
    return {
      ...m,
      initials: initialsFor(m.user.name),
      avatarBg: colors.bg,
      avatarText: colors.color,
    }
  }),
)

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
</script>

<template>
  <div>
    <h1 class="mb-1.5 text-2xl font-extrabold tracking-tight">{{ t('team.title') }}</h1>
    <p class="mb-6 text-[15px] text-app-slate">{{ t('team.subtitle') }}</p>

    <div class="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-2">
      <div class="rounded-3xl bg-white p-6.5">
        <h2 class="mb-4.5 text-lg font-extrabold">{{ t('team.inviteHeading') }}</h2>

        <p
          v-if="isReadOnly"
          class="mb-3.5 rounded-xl bg-app-warning-bg px-3.5 py-2.5 text-sm text-app-warning"
        >
          {{ t('team.trialExpired') }}
        </p>

        <form class="flex flex-col gap-3.5" @submit.prevent="submit">
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            :placeholder="t('team.emailPlaceholder')"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <select
            v-model="form.role"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          >
            <option value="member">{{ t('team.roleMember') }}</option>
            <option value="admin">{{ t('team.roleAdmin') }}</option>
          </select>
          <p v-if="errors.email" class="text-xs text-app-danger">{{ errors.email }}</p>
          <button
            type="submit"
            :disabled="loading || isReadOnly"
            class="rounded-full bg-app-accent py-3 text-center text-[15px] font-bold text-white"
            :class="loading || isReadOnly ? 'opacity-60' : ''"
          >
            {{ loading ? t('team.submitting') : t('team.submit') }}
          </button>
          <p
            v-if="successMessage"
            class="rounded-xl bg-app-surface px-3.5 py-2.5 text-[13.5px] text-app-ink"
          >
            {{ successMessage }}
          </p>
          <p
            v-if="serverError"
            class="rounded-xl bg-app-danger-bg px-3.5 py-2.5 text-sm text-app-danger"
          >
            {{ serverError }}
          </p>
        </form>

        <h2 class="mb-3.5 mt-6 text-lg font-extrabold">{{ t('team.pendingHeading') }}</h2>
        <p v-if="loadingInvites" class="text-sm text-app-muted">{{ t('common.loading') }}</p>
        <p v-else-if="invites.length === 0" class="text-sm text-app-muted">{{ t('team.empty') }}</p>
        <div v-else>
          <div
            v-for="invite in invites"
            :key="invite.id"
            class="flex items-center justify-between border-b border-app-surface-alt py-3.5 last:border-0"
          >
            <div>
              <div class="text-[14.5px] font-bold">{{ invite.email }}</div>
              <div class="text-[13px] text-app-muted">{{ roleLabel(invite.role) }}</div>
            </div>
            <button
              type="button"
              :disabled="isReadOnly"
              class="text-[13.5px] font-bold text-app-danger"
              :class="isReadOnly ? 'opacity-60' : ''"
              @click="revoke(invite.id)"
            >
              {{ t('team.revoke') }}
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-3xl bg-white p-6.5">
        <h2 class="mb-4.5 text-lg font-extrabold">
          {{ t('team.membersHeading', { count: members.length }) }}
        </h2>
        <div
          v-for="member in decoratedMembers"
          :key="member.id"
          class="flex items-center gap-3.5 border-b border-app-surface-alt py-3.5 last:border-0"
        >
          <div
            class="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            :style="{ background: member.avatarBg, color: member.avatarText }"
          >
            {{ member.initials }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[14.5px] font-bold">{{ member.user.name }}</div>
            <div class="text-[13px] text-app-muted">{{ member.user.email }}</div>
          </div>
          <span
            class="shrink-0 rounded-full bg-app-surface-alt px-2.75 py-1 text-xs font-bold text-app-slate"
          >
            {{ roleLabel(member.role) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
