<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'
import { authClient } from '../lib/auth-client'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

const form = ref({ email: '', password: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

const schema = computed(() =>
  z.object({
    email: z.string().email(t('auth.signIn.validationEmail')),
    password: z.string().min(1, t('auth.signIn.validationPassword')),
  }),
)

async function submit() {
  errors.value = {}
  serverError.value = ''

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      switch (field) {
        case 'email':
          errors.value.email ||= issue.message
          break
        case 'password':
          errors.value.password ||= issue.message
          break
      }
    }
    return
  }

  loading.value = true
  try {
    const { error } = await authClient.signIn.email({
      email: form.value.email,
      password: form.value.password,
    })

    if (error) {
      serverError.value = t('auth.signIn.genericError')
      return
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redirect)
  } catch {
    serverError.value = t('common.networkError')
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
          <h1 class="text-2xl font-bold text-brand-dark">{{ t('auth.signIn.title') }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ t('auth.signIn.subtitle') }}</p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-sm font-medium text-brand-dark mb-1" for="email">{{
              t('auth.signIn.emailLabel')
            }}</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              :placeholder="t('auth.signIn.emailPlaceholder')"
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
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-brand-dark" for="password">{{
                t('auth.signIn.passwordLabel')
              }}</label>
              <RouterLink
                to="/forgot-password"
                class="text-xs text-brand-teal font-medium hover:underline"
                >{{ t('auth.signIn.forgotPassword') }}</RouterLink
              >
            </div>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              :placeholder="t('auth.signIn.passwordPlaceholder')"
              class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
              :class="
                errors.password
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-brand-border focus:border-brand-teal'
              "
            />
            <p v-if="errors.password" class="text-xs text-red-500 mt-1">{{ errors.password }}</p>
          </div>

          <p
            v-if="route.query.reset === 'success'"
            class="text-sm text-brand-teal bg-brand-surface rounded-lg px-3 py-2"
          >
            {{ t('auth.signIn.resetSuccess') }}
          </p>

          <p
            v-if="route.query.invited === 'success'"
            class="text-sm text-brand-teal bg-brand-surface rounded-lg px-3 py-2"
          >
            {{ t('auth.signIn.inviteSuccess') }}
          </p>

          <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {{ serverError }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold transition-opacity mt-2"
            :class="loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
          >
            {{ loading ? t('auth.signIn.submitting') : t('auth.signIn.submit') }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-500 mt-6">
          {{ t('auth.signIn.noAccount') }}
          <RouterLink to="/sign-up" class="text-brand-teal font-medium hover:underline">{{
            t('auth.signIn.signUpLink')
          }}</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>
