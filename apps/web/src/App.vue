<script setup lang="ts">
import { watchEffect } from 'vue'
import { SUPPORTED_LOCALES, type Locale } from '@staffcomplete/shared'
import { authClient } from './lib/auth-client'
import { applyLocale } from './i18n'

function detectBrowserLocale(): Locale {
  const preferred = navigator.languages ?? [navigator.language]
  for (const tag of preferred) {
    const candidate = tag.slice(0, 2).toLowerCase()
    if ((SUPPORTED_LOCALES as readonly string[]).includes(candidate)) {
      return candidate as Locale
    }
  }
  return 'en'
}

const browserLocale = detectBrowserLocale()
const activeOrganization = authClient.useActiveOrganization()

// Locale is an org-level setting (ADR-0016): once signed in, the active
// organization's locale wins. Signed-out pages (sign in/up, invite accept)
// have no organization context yet, so they fall back to the browser's
// preferred language.
watchEffect(() => {
  const orgLocale = activeOrganization.value.data?.locale
  const isSupported = (SUPPORTED_LOCALES as readonly string[]).includes(orgLocale ?? '')
  applyLocale(isSupported ? (orgLocale as Locale) : browserLocale)
})
</script>

<template>
  <RouterView />
</template>
