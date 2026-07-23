import { z } from 'zod'

// Locale is an organization-level setting (ADR-0016), not per-user — every
// member of an org sees the app in the same language.
export const SUPPORTED_LOCALES = ['en', 'ru', 'he'] as const

export const localeSchema = z.enum(SUPPORTED_LOCALES)

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

const RTL_LOCALES = new Set<Locale>(['he'])

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.has(locale)
}

export function textDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr'
}
