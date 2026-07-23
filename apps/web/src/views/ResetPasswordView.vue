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

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : undefined,
)

const form = ref({ password: '', confirmPassword: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

const schema = computed(() =>
  z
    .object({
      password: z
        .string()
        .min(8, t('auth.resetPassword.validationPasswordMin'))
        .regex(/[A-Z]/, t('auth.resetPassword.validationPasswordUppercase'))
        .regex(/[0-9]/, t('auth.resetPassword.validationPasswordNumber')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.resetPassword.validationMismatch'),
      path: ['confirmPassword'],
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
    serverError.value = t('auth.resetPassword.invalidLinkError')
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
          ? t('auth.resetPassword.invalidTokenError')
          : t('common.genericError')
      return
    }

    await router.push({ name: 'sign-in', query: { reset: 'success' } })
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
        <template v-if="token">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              {{ t('auth.resetPassword.title') }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">{{ t('auth.resetPassword.subtitle') }}</p>
          </div>

          <form class="space-y-4" @submit.prevent="submit">
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="password">{{
                t('auth.resetPassword.newPasswordLabel')
              }}</label>
              <input
                id="password"
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                :placeholder="t('auth.resetPassword.newPasswordPlaceholder')"
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
              <label class="block text-sm font-medium text-brand-dark mb-1" for="confirmPassword">{{
                t('auth.resetPassword.confirmLabel')
              }}</label>
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('auth.resetPassword.confirmPlaceholder')"
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
              class="w-full bg-app-accent text-white py-2.5 rounded-full text-sm font-bold transition-opacity mt-2"
              :class="loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
            >
              {{ loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit') }}
            </button>
          </form>
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold text-brand-dark mb-2">
            {{ t('auth.resetPassword.invalidTitle') }}
          </h1>
          <p class="text-sm text-gray-500">
            {{ t('auth.resetPassword.invalidBody') }}
          </p>
          <RouterLink
            to="/forgot-password"
            class="block mt-6 text-sm text-brand-teal font-medium hover:underline"
          >
            {{ t('auth.resetPassword.requestNewLink') }}
          </RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>
