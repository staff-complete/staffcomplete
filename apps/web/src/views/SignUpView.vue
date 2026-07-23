<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'

const { t } = useI18n()
const router = useRouter()

const form = ref({ name: '', email: '', password: '', company: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)

const schema = computed(() =>
  z.object({
    name: z.string().min(2, t('auth.signUp.validationName')),
    email: z.string().email(t('auth.signUp.validationEmail')),
    password: z
      .string()
      .min(8, t('auth.signUp.validationPasswordMin'))
      .regex(/[A-Z]/, t('auth.signUp.validationPasswordUppercase'))
      .regex(/[0-9]/, t('auth.signUp.validationPasswordNumber')),
    company: z.string().min(2, t('auth.signUp.validationCompany')),
  }),
)

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
  if (s <= 1) return t('auth.signUp.strengthWeak')
  if (s <= 2) return t('auth.signUp.strengthFair')
  if (s <= 3) return t('auth.signUp.strengthGood')
  return t('auth.signUp.strengthStrong')
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

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      switch (field) {
        case 'name':
          errors.value.name ||= issue.message
          break
        case 'email':
          errors.value.email ||= issue.message
          break
        case 'password':
          errors.value.password ||= issue.message
          break
        case 'company':
          errors.value.company ||= issue.message
          break
      }
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
      await router.push({ name: 'check-email', query: { email: form.value.email } })
      return
    }

    const data = (await res.json()) as { message?: string }
    if (res.status === 409) {
      errors.value.email = data.message ?? t('auth.signUp.emailExists')
    } else {
      serverError.value = data.message ?? t('common.genericError')
    }
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
          <h1 class="text-2xl font-bold text-brand-dark">{{ t('auth.signUp.title') }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ t('auth.signUp.subtitle') }}</p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-sm font-medium text-brand-dark mb-1" for="name">{{
              t('auth.signUp.nameLabel')
            }}</label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              autocomplete="name"
              :placeholder="t('auth.signUp.namePlaceholder')"
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
            <label class="block text-sm font-medium text-brand-dark mb-1" for="email">{{
              t('auth.signUp.emailLabel')
            }}</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              :placeholder="t('auth.signUp.emailPlaceholder')"
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
            <label class="block text-sm font-medium text-brand-dark mb-1" for="password">{{
              t('auth.signUp.passwordLabel')
            }}</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              :placeholder="t('auth.signUp.passwordPlaceholder')"
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
            <label class="block text-sm font-medium text-brand-dark mb-1" for="company">{{
              t('auth.signUp.companyLabel')
            }}</label>
            <input
              id="company"
              v-model="form.company"
              type="text"
              autocomplete="organization"
              :placeholder="t('auth.signUp.companyPlaceholder')"
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
            {{ loading ? t('auth.signUp.submitting') : t('auth.signUp.submit') }}
          </button>
        </form>

        <p class="text-center text-sm text-gray-500 mt-6">
          {{ t('auth.signUp.haveAccount') }}
          <RouterLink to="/sign-in" class="text-brand-teal font-medium hover:underline">{{
            t('auth.signUp.signInLink')
          }}</RouterLink>
        </p>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">
        {{ t('auth.signUp.termsPrefix') }}
        <a href="/terms" class="underline">{{ t('auth.signUp.termsLink') }}</a>
        {{ t('auth.signUp.and') }}
        <a href="/privacy" class="underline">{{ t('auth.signUp.privacyLink') }}</a
        >.
      </p>
    </div>
  </div>
</template>
