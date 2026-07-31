import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import { fetchTrialStatus } from './useTrialStatus'

describe('fetchTrialStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed trial status on success', async () => {
    const body = {
      status: 'trialing',
      trialEndsAt: '2026-08-01T00:00:00.000Z',
      daysRemaining: 3,
      isReadOnly: false,
    }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    const result = await fetchTrialStatus()

    expect(result).toEqual(body)
  })

  it('returns null when the org has no subscription yet', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))

    const result = await fetchTrialStatus()

    expect(result).toBeNull()
  })

  it('throws an ApiError on an error response that is not 404', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Sign-in required.' }), {
        status: 403,
      }),
    )

    const err = (await fetchTrialStatus().catch((e: unknown) => e)) as ApiError

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
  })
})
