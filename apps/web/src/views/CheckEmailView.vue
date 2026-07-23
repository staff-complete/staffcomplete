<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLogo from '../components/AppLogo.vue'

const { t } = useI18n()
const route = useRoute()
const email = route.query.email as string | undefined
</script>

<template>
  <div class="min-h-screen bg-brand-surface flex flex-col items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <div class="flex justify-center mb-8">
        <AppLogo class="h-8" />
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8 text-center">
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

        <h1 class="text-2xl font-bold text-brand-dark mb-2">{{ t('auth.checkEmail.title') }}</h1>
        <p class="text-sm text-gray-500">
          {{
            email
              ? t('auth.checkEmail.bodyWithEmail', { email })
              : t('auth.checkEmail.bodyWithoutEmail')
          }}
        </p>

        <div class="mt-6 p-4 bg-brand-surface rounded-xl text-left text-sm text-gray-600 space-y-2">
          <p class="font-medium text-brand-dark">{{ t('auth.checkEmail.helpTitle') }}</p>
          <ul class="list-disc list-inside space-y-1 text-gray-500">
            <li>{{ t('auth.checkEmail.tipSpam') }}</li>
            <li>{{ t('auth.checkEmail.tipEmail') }}</li>
            <li>{{ t('auth.checkEmail.tipExpiry') }}</li>
          </ul>
        </div>

        <RouterLink
          to="/sign-up"
          class="block mt-6 text-sm text-brand-teal font-medium hover:underline"
        >
          {{ t('auth.checkEmail.backToSignUp') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
