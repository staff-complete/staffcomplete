<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'
import { authClient } from '../lib/auth-client'

const { t } = useI18n()

const email = ref('')
const error = ref('')
const loading = ref(false)
const submitted = ref(false)

const schema = computed(() => z.string().email(t('auth.forgotPassword.validationEmail')))

async function submit() {
  error.value = ''

  const result = schema.value.safeParse(email.value)
  if (!result.success) {
    error.value = result.error.issues[0]?.message ?? t('auth.forgotPassword.validationEmail')
    return
  }

  loading.value = true
  try {
    // Must be absolute: Better Auth resolves a relative redirectTo against
    // its own server origin (the API), not the app the link should land
    // on, since the reset click is handled server-side before redirecting.
    await authClient.requestPasswordReset({
      email: email.value,
      redirectTo: `${window.location.origin}/reset-password`,
    })
    // Always show the same confirmation, regardless of whether the account
    // exists, so the response gives no signal about account existence.
    submitted.value = true
  } catch {
    submitted.value = true
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

      <div v-if="!submitted" class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-brand-dark">{{ t('auth.forgotPassword.title') }}</h1>
          <p class="text-sm text-gray-500 mt-1">
            {{ t('auth.forgotPassword.subtitle') }}
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-sm font-medium text-brand-dark mb-1" for="email">{{
              t('auth.forgotPassword.emailLabel')
            }}</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              :placeholder="t('auth.forgotPassword.emailPlaceholder')"
              class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
              :class="
                error
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-brand-border focus:border-brand-teal'
              "
            />
            <p v-if="error" class="text-xs text-red-500 mt-1">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-app-accent text-white py-2.5 rounded-full text-sm font-bold transition-opacity mt-2"
            :class="loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
          >
            {{ loading ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit') }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-500 mt-6">
          <RouterLink to="/sign-in" class="text-brand-teal font-medium hover:underline">{{
            t('auth.forgotPassword.backToSignIn')
          }}</RouterLink>
        </p>
      </div>

      <div v-else class="bg-white rounded-2xl shadow-sm border border-brand-border p-8 text-center">
        <div
          class="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-7 h-7 text-brand-teal"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>

        <h1 class="text-2xl font-bold text-brand-dark mb-2">
          {{ t('auth.forgotPassword.checkTitle') }}
        </h1>
        <p class="text-sm text-gray-500">
          {{ t('auth.forgotPassword.checkBody', { email }) }}
        </p>

        <RouterLink
          to="/sign-in"
          class="block mt-6 text-sm text-brand-teal font-medium hover:underline"
        >
          {{ t('auth.forgotPassword.backToSignIn') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
