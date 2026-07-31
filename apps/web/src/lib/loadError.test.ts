import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { loadErrorDetail } from './loadError'

const NETWORK = 'Unable to connect. Please check your connection and try again.'

describe('loadErrorDetail', () => {
  it("shows the server's own message for an ApiError", () => {
    const err = new ApiError(402, 'TRIAL_EXPIRED', 'Your trial has ended. Subscribe to continue.')

    expect(loadErrorDetail(err, NETWORK)).toBe('Your trial has ended. Subscribe to continue.')
  })

  it('shows the admin message rather than a generic one on 403', () => {
    // orgAuth returns this for both "no session" and "not an admin", so it's
    // what a member hitting an admin-only page actually sees.
    const err = new ApiError(403, 'FORBIDDEN', 'Admin access required.')

    expect(loadErrorDetail(err, NETWORK)).toBe('Admin access required.')
  })

  it('falls back to the network message when there was no response at all', () => {
    // apiFetch lets a network failure through as a plain TypeError rather
    // than wrapping it, which is exactly what this branch keys off.
    expect(loadErrorDetail(new TypeError('Failed to fetch'), NETWORK)).toBe(NETWORK)
  })

  it('falls back for a non-Error value', () => {
    expect(loadErrorDetail(undefined, NETWORK)).toBe(NETWORK)
    expect(loadErrorDetail('boom', NETWORK)).toBe(NETWORK)
  })

  it('falls back when an ApiError carries an empty message', () => {
    // Non-JSON error bodies leave message as the status text, which can be
    // empty — better the network line than a blank detail row.
    const err = new ApiError(500, 'UNKNOWN', '')

    expect(loadErrorDetail(err, NETWORK)).toBe(NETWORK)
  })
})
