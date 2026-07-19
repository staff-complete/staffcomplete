const MS_PER_DAY = 24 * 60 * 60 * 1000

export const TRIAL_LENGTH_DAYS = 14

export interface TrialState {
  daysRemaining: number
  isExpired: boolean
}

// Single source of truth for "how much trial is left," shared by apps/api
// (middleware, jobs, the trial-status route) and apps/web (the banner) so
// the 3-day-reminder and expiry math can't drift between them (ADR-0015).
export function computeTrialState(trialEndsAt: Date, now: Date = new Date()): TrialState {
  const msRemaining = trialEndsAt.getTime() - now.getTime()
  return {
    // Ceil, then clamp to 0: a trial a few hours past trialEndsAt has a
    // small negative msRemaining, which must report 0 days left, not 1.
    daysRemaining: Math.max(0, Math.ceil(msRemaining / MS_PER_DAY)),
    isExpired: msRemaining <= 0,
  }
}
