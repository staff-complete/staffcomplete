<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'

const route = useRoute()
const router = useRouter()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : undefined,
)

type Invite = {
  email: string
  role: string
  organizationName: string | null
  accountExists: boolean
  sessionMatches: boolean
}

const checkingInvite = ref(true)
const invite = ref<Invite | null>(null)

const form = ref({ name: '', password: '', confirmPassword: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)
const joining = ref(false)

const schema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

onMounted(async () => {
  if (!token.value) {
    checkingInvite.value = false
    return
  }

  try {
    const res = await fetch(`/api/invites/${token.value}`)
    if (res.ok) {
      invite.value = (await res.json()) as Invite
    }
  } finally {
    checkingInvite.value = false
  }
})

async function join() {
  serverError.value = ''
  joining.value = true
  try {
    const res = await fetch(`/api/invites/${token.value}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (res.ok) {
      await router.push('/dashboard')
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? 'Something went wrong. Please try again.'
  } catch {
    serverError.value = 'Unable to connect. Please check your connection and try again.'
  } finally {
    joining.value = false
  }
}

async function submit() {
  errors.value = {}
  serverError.value = ''

  const result = schema.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      switch (field) {
        case 'name':
          errors.value.name ||= issue.message
          break
        case 'password':
          errors.value.password ||= issue.message
          break
        case 'confirmPassword':
          errors.value.confirmPassword ||= issue.message
          break
      }
    }
    return
  }

  loading.value = true
  try {
    const res = await fetch(`/api/invites/${token.value}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.value.name, password: form.value.password }),
    })

    if (res.ok) {
      await router.push({ name: 'sign-in', query: { invited: 'success' } })
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? 'Something went wrong. Please try again.'
  } catch {
    serverError.value = 'Unable to connect. Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface flex flex-col items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <div class="flex justify-center mb-8">
        <AppLogo class="h-8" />
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <p v-if="checkingInvite" class="text-sm text-gray-500">Checking your invite…</p>

        <template v-else-if="invite && invite.accountExists && invite.sessionMatches">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              Join {{ invite.organizationName ?? 'this team' }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              You're signed in as
              <span class="font-medium text-brand-dark">{{ invite.email }}</span
              >. Join as {{ invite.role === 'admin' ? 'an admin' : 'a member' }}.
            </p>
          </div>

          <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">
            {{ serverError }}
          </p>

          <button
            type="button"
            :disabled="joining"
            class="w-full bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            :class="joining ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
            @click="join"
          >
            {{ joining ? 'Joining…' : `Join ${invite.organizationName ?? 'team'}` }}
          </button>
        </template>

        <template v-else-if="invite && invite.accountExists">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              Join {{ invite.organizationName ?? 'this team' }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              You already have a StaffComplete account for
              <span class="font-medium text-brand-dark">{{ invite.email }}</span
              >. Sign in to accept this invite.
            </p>
          </div>

          <RouterLink
            :to="{ path: '/sign-in', query: { redirect: route.fullPath } }"
            class="block w-full text-center bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in to accept
          </RouterLink>
        </template>

        <template v-else-if="invite">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              Join {{ invite.organizationName ?? 'your team' }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              Set a password for
              <span class="font-medium text-brand-dark">{{ invite.email }}</span> to finish joining
              as {{ invite.role === 'admin' ? 'an admin' : 'a member' }}.
            </p>
          </div>

          <form class="space-y-4" @submit.prevent="submit">
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="name"
                >Full name</label
              >
              <input
                id="name"
                v-model="form.name"
                type="text"
                autocomplete="name"
                placeholder="Jane Smith"
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
              <label class="block text-sm font-medium text-brand-dark mb-1" for="password"
                >Password</label
              >
              <input
                id="password"
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                placeholder="Min. 8 characters"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.password
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.password" class="text-xs text-red-500 mt-1">
                {{ errors.password }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="confirmPassword"
                >Confirm password</label
              >
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Re-enter your password"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.confirmPassword
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.confirmPassword" class="text-xs text-red-500 mt-1">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {{ serverError }}
            </p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold transition-opacity mt-2"
              :class="loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
            >
              {{ loading ? 'Joining…' : 'Join team' }}
            </button>
          </form>
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold text-brand-dark mb-2">Invalid invite</h1>
          <p class="text-sm text-gray-500">
            This invite link is missing, invalid, or has expired. Ask an admin to send you a new
            one.
          </p>
          <RouterLink
            to="/sign-in"
            class="block mt-6 text-sm text-brand-teal font-medium hover:underline"
          >
            ← Back to sign in
          </RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>
