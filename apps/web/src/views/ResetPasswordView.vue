<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'
import { authClient } from '../lib/auth-client'

const route = useRoute()
const router = useRouter()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : undefined,
)

const form = ref({ password: '', confirmPassword: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

const schema = z
  .object({
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

async function submit() {
  errors.value = {}
  serverError.value = ''

  const result = schema.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      switch (field) {
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

  if (!token.value) {
    serverError.value = 'This reset link is invalid. Please request a new one.'
    return
  }

  loading.value = true
  try {
    const { error } = await authClient.resetPassword({
      newPassword: form.value.password,
      token: token.value,
    })

    if (error) {
      serverError.value =
        error.code === 'INVALID_TOKEN'
          ? 'This reset link has expired or already been used. Please request a new one.'
          : 'Something went wrong. Please try again.'
      return
    }

    await router.push({ name: 'sign-in', query: { reset: 'success' } })
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
        <template v-if="token">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">Set a new password</h1>
            <p class="text-sm text-gray-500 mt-1">Choose a new password for your account.</p>
          </div>

          <form class="space-y-4" @submit.prevent="submit">
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="password"
                >New password</label
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
                placeholder="Re-enter your new password"
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
              {{ loading ? 'Updating…' : 'Update password' }}
            </button>
          </form>
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold text-brand-dark mb-2">Invalid reset link</h1>
          <p class="text-sm text-gray-500">
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <RouterLink
            to="/forgot-password"
            class="block mt-6 text-sm text-brand-teal font-medium hover:underline"
          >
            Request a new link
          </RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>
