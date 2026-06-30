<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'

const router = useRouter()

const form = ref({ name: '', email: '', password: '', company: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

const schema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid work email required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
})

const passwordStrength = computed(() => {
  const p = form.value.password
  if (!p) return 0
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  return score
})

const strengthLabel = computed(() => {
  const s = passwordStrength.value
  if (s <= 1) return 'Weak'
  if (s <= 2) return 'Fair'
  if (s <= 3) return 'Good'
  return 'Strong'
})

const strengthColor = computed(() => {
  const s = passwordStrength.value
  if (s <= 1) return 'bg-red-400'
  if (s <= 2) return 'bg-yellow-400'
  if (s <= 3) return 'bg-blue-400'
  return 'bg-brand-teal'
})

async function submit() {
  errors.value = {}
  serverError.value = ''

  const result = schema.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (!errors.value[field]) errors.value[field] = issue.message
    }
    return
  }

  loading.value = true
  try {
    const res = await fetch('/api/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })

    if (res.ok) {
      router.push({ name: 'check-email', query: { email: form.value.email } })
      return
    }

    const data = (await res.json()) as { message?: string }
    if (res.status === 409) {
      errors.value.email = data.message ?? 'An account with this email already exists.'
    } else {
      serverError.value = data.message ?? 'Something went wrong. Please try again.'
    }
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
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-brand-dark">Create your account</h1>
          <p class="text-sm text-gray-500 mt-1">Start your free 14-day trial. No card required.</p>
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
            <label class="block text-sm font-medium text-brand-dark mb-1" for="email"
              >Work email</label
            >
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              placeholder="jane@company.com"
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
            <div v-if="form.password" class="mt-2 flex items-center gap-2">
              <div class="flex gap-1 flex-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors"
                  :class="i <= passwordStrength ? strengthColor : 'bg-gray-200'"
                />
              </div>
              <span class="text-xs text-gray-500">{{ strengthLabel }}</span>
            </div>
            <p v-if="errors.password" class="text-xs text-red-500 mt-1">{{ errors.password }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-brand-dark mb-1" for="company"
              >Company name</label
            >
            <input
              id="company"
              v-model="form.company"
              type="text"
              autocomplete="organization"
              placeholder="Acme Corp"
              class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
              :class="
                errors.company
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-brand-border focus:border-brand-teal'
              "
            />
            <p v-if="errors.company" class="text-xs text-red-500 mt-1">{{ errors.company }}</p>
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
            {{ loading ? 'Creating account…' : 'Create account' }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-500 mt-6">
          Already have an account?
          <RouterLink to="/sign-in" class="text-brand-teal font-medium hover:underline"
            >Sign in</RouterLink
          >
        </p>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">
        By creating an account you agree to our
        <a href="/terms" class="underline">Terms</a> and
        <a href="/privacy" class="underline">Privacy Policy</a>.
      </p>
    </div>
  </div>
</template>
