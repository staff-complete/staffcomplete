import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, textDirection, type Locale } from '@staffcomplete/shared'
import { ruPluralRule } from './pluralRules'
import en from './locales/en'
import ru from './locales/ru'
import he from './locales/he'

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, ru, he },
  pluralRules: { ru: ruPluralRule },
})

// Locale is an org-level setting (ADR-0016) — call this whenever the active
// organization (or its locale) changes, not just once at boot.
export function applyLocale(locale: Locale) {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  document.documentElement.dir = textDirection(locale)
}
