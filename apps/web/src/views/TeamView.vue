<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { z } from 'zod'

type Invite = { id: string; email: string; role: string; expiresAt: string; createdAt: string }

const invites = ref<Invite[]>([])
const loadingInvites = ref(true)

const form = ref({ email: '', role: 'member' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const successMessage = ref('')
const loading = ref(false)

const schema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'member']),
})

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
  errors.value = {}
  serverError.value = ''
  successMessage.value = ''

  const result = schema.safeParse(form.value)
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
      successMessage.value = `Invite sent to ${form.value.email}.`
      form.value = { email: '', role: 'member' }
      await loadInvites()
      return
    }

    const data = (await res.json()) as { message?: string }
    if (res.status === 409) {
      errors.value.email = data.message ?? 'An invite or account already exists for this email.'
    } else {
      serverError.value = data.message ?? 'Something went wrong. Please try again.'
    }
  } catch {
    serverError.value = 'Unable to connect. Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

async function revoke(id: string) {
  await fetch(`/api/invites/${id}`, { method: 'DELETE' })
  await loadInvites()
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">Team</h1>
        <RouterLink to="/dashboard" class="text-sm text-brand-teal font-medium hover:underline"
          >← Back to dashboard</RouterLink
        >
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">Invite a team member</h2>

        <form class="space-y-4" @submit.prevent="submit">
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-sm font-medium text-brand-dark mb-1" for="email"
                >Email</label
              >
              <input
                id="email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                placeholder="colleague@company.com"
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
              <label class="block text-sm font-medium text-brand-dark mb-1" for="role">Role</label>
              <select
                id="role"
                v-model="form.role"
                class="px-3 py-2 rounded-lg border border-brand-border text-sm outline-none focus:border-brand-teal"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
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
            :disabled="loading"
            class="bg-brand-teal text-white py-2.5 px-5 rounded-lg text-sm font-semibold transition-opacity"
            :class="loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
          >
            {{ loading ? 'Sending…' : 'Send invite' }}
          </button>
        </form>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <h2 class="text-lg font-semibold text-brand-dark mb-4">Pending invites</h2>

        <p v-if="loadingInvites" class="text-sm text-gray-500">Loading…</p>
        <p v-else-if="invites.length === 0" class="text-sm text-gray-500">No pending invites.</p>
        <ul v-else class="divide-y divide-brand-border">
          <li
            v-for="invite in invites"
            :key="invite.id"
            class="flex items-center justify-between py-3"
          >
            <div>
              <p class="text-sm font-medium text-brand-dark">{{ invite.email }}</p>
              <p class="text-xs text-gray-500 capitalize">{{ invite.role }}</p>
            </div>
            <button
              type="button"
              class="text-sm text-red-500 font-medium hover:underline"
              @click="revoke(invite.id)"
            >
              Revoke
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
