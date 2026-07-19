import type { TrialStatus } from '../composables/useTrialStatus'

export interface TrialBannerCopy {
  message: string
  variant: 'countdown' | 'expired'
}

// Pulled out of TrialBanner.vue so the copy logic is testable directly —
// this repo has no component-mounting test setup (no jsdom, no
// @vue/test-utils, no .vue file anywhere has a test), so the template
// itself stays untested like every other component here.
export function describeTrialBanner(status: TrialStatus): TrialBannerCopy {
  if (status.isReadOnly) {
    return {
      message: 'Your trial has ended. Subscribe to keep using StaffComplete.',
      variant: 'expired',
    }
  }

  const days = status.daysRemaining
  return {
    message: `${days} ${days === 1 ? 'day' : 'days'} left in your free trial.`,
    variant: 'countdown',
  }
}
