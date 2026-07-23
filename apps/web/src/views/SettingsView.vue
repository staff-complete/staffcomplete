<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import { SUPPORTED_LOCALES, type Locale } from '@staffcomplete/shared'
import { authClient } from '../lib/auth-client'

const { t } = useI18n()
const activeOrganization = authClient.useActiveOrganization()

const form = ref({ name: '', logo: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const successMessage = ref('')
const saving = ref(false)

watch(
  () => activeOrganization.value.data,
  (org) => {
    if (org) form.value = { name: org.name, logo: org.logo ?? '' }
  },
  { immediate: true },
)

const schema = computed(() =>
  z.object({
    name: z.string().min(2, t('settings.validationName')),
    logo: z.union([z.string().url(t('settings.validationLogo')), z.literal('')]),
  }),
)

async function saveDetails() {
  errors.value = {}
  serverError.value = ''
  successMessage.value = ''

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      errors.value[field] ||= issue.message
    }
    return
  }

  saving.value = true
  try {
    const { error } = await authClient.organization.update({
      data: { name: form.value.name, logo: form.value.logo || null },
    })
    if (error) {
      serverError.value = t('common.genericError')
      return
    }
    await activeOrganization.value.refetch()
    successMessage.value = t('settings.saved')
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    saving.value = false
  }
}

const changingLocale = ref(false)
const localeError = ref('')

async function changeLocale(locale: Locale) {
  if (locale === activeOrganization.value.data?.locale || changingLocale.value) return
  localeError.value = ''
  changingLocale.value = true
  try {
    const { error } = await authClient.organization.update({ data: { locale } })
    if (error) localeError.value = t('shell.languageError')
  } catch {
    localeError.value = t('shell.languageError')
  } finally {
    changingLocale.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="mb-1.5 text-2xl font-extrabold tracking-tight">{{ t('nav.settings') }}</h1>
    <p class="mb-6 text-[15px] text-app-slate">{{ t('settings.subtitle') }}</p>

    <div class="mb-4.5 rounded-3xl bg-white p-6.5">
      <h2 class="mb-4.5 text-lg font-extrabold">{{ t('settings.detailsHeading') }}</h2>

      <form class="flex flex-col gap-4" @submit.prevent="saveDetails">
        <div class="flex items-center gap-4">
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-app-surface-alt text-sm font-bold text-app-slate"
          >
            <img v-if="form.logo" :src="form.logo" alt="" class="h-full w-full object-cover" />
            <span v-else>{{ form.name.slice(0, 1).toUpperCase() }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="logo">{{
              t('settings.logoLabel')
            }}</label>
            <input
              id="logo"
              v-model="form.logo"
              type="url"
              :placeholder="t('settings.logoPlaceholder')"
              class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
            />
            <p class="mt-1 text-xs text-app-muted">{{ t('settings.logoDescription') }}</p>
            <p v-if="errors.logo" class="mt-1 text-xs text-app-danger">{{ errors.logo }}</p>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-[13px] font-bold text-app-slate" for="name">{{
            t('settings.nameLabel')
          }}</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            :placeholder="t('settings.namePlaceholder')"
            class="w-full rounded-xl border border-app-border px-4 py-3 text-[14.5px] outline-none"
          />
          <p v-if="errors.name" class="mt-1 text-xs text-app-danger">{{ errors.name }}</p>
        </div>

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

        <button
          type="submit"
          :disabled="saving"
          class="w-fit rounded-full bg-app-accent px-6 py-3 text-sm font-bold text-white"
          :class="saving ? 'opacity-60' : ''"
        >
          {{ saving ? t('settings.saving') : t('settings.save') }}
        </button>
      </form>
    </div>

    <div class="rounded-3xl bg-white p-6.5">
      <h2 class="mb-1 text-lg font-extrabold">{{ t('settings.languageHeading') }}</h2>
      <p class="mb-4.5 text-sm text-app-slate">{{ t('settings.languageDescription') }}</p>

      <div class="flex gap-2">
        <button
          v-for="loc in SUPPORTED_LOCALES"
          :key="loc"
          type="button"
          :disabled="changingLocale"
          class="rounded-full px-5 py-2.5 text-sm font-bold"
          :class="
            activeOrganization.data?.locale === loc
              ? 'bg-app-accent text-white'
              : 'bg-app-bg text-app-slate'
          "
          @click="changeLocale(loc)"
        >
          {{ t(`locale.${loc}`) }}
        </button>
      </div>
      <p v-if="localeError" class="mt-3 text-xs text-app-danger">{{ localeError }}</p>
    </div>
  </div>
</template>
