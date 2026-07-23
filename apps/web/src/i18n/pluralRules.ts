import type { PluralizationRule } from 'vue-i18n'

// Russian has 4 plural forms (zero/one/few/many) instead of English's 2 —
// vue-i18n's default rule (index 0 for n===1, else 1) mis-pluralizes most
// Russian numbers. This is vue-i18n's documented custom-pluralization
// pattern for Slavic languages: https://vue-i18n.intlify.dev/guide/essentials/pluralization.html#custom-pluralization
export const ruPluralRule: PluralizationRule = (choice, choicesLength) => {
  if (choice === 0) return 0

  const teen = choice > 10 && choice < 20
  const endsWithOne = choice % 10 === 1
  if (!teen && endsWithOne) return 1

  const endsWithFewRange = choice % 10 >= 2 && choice % 10 <= 4
  if (!teen && endsWithFewRange) return 2

  return choicesLength < 4 ? 2 : 3
}
