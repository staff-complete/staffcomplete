import { ApiError } from './api'

/**
 * The detail line shown under "Couldn't load this." for a failed query.
 *
 * Prefers the server's own message — it names the actual problem ("Your
 * trial has ended. Subscribe to continue.", "Admin access required.") where
 * a generic string would not. Anything that isn't an `ApiError` means no
 * response came back at all, which `apiFetch` surfaces as a plain
 * `TypeError`; that gets the localized network message instead.
 *
 * Split out of LoadError.vue so it's testable as a plain function — this
 * repo has no jsdom/component-mounting setup, the same reason
 * router/guards.ts and useTrialStatus.ts take their dependencies as
 * arguments rather than reaching for the DOM.
 */
export function loadErrorDetail(error: unknown, networkMessage: string): string {
  if (error instanceof ApiError && error.message) {
    return error.message
  }
  return networkMessage
}
