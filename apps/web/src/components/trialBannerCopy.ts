import type { TrialStatus } from '../composables/useTrialStatus'

export interface TrialBannerCopy {
  variant: 'countdown' | 'expired'
  daysRemaining: number
}

// Pulled out of TrialBanner.vue so the variant/daysRemaining logic is
// testable directly — this repo has no component-mounting test setup (no
// jsdom, no @vue/test-utils, no .vue file anywhere has a test), so the
// template itself stays untested like every other component here. Message
// text lives in TrialBanner.vue via vue-i18n (ADR-0016), since it's
// locale-dependent and this helper isn't.
export function describeTrialBanner(status: TrialStatus): TrialBannerCopy {
  return {
    variant: status.isReadOnly ? 'expired' : 'countdown',
    daysRemaining: status.daysRemaining,
  }
}
