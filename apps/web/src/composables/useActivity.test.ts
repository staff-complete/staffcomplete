import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import { fetchActivity } from './useActivity'

describe('fetchActivity', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed events on success', async () => {
    const events = [
      {
        type: 'step_completed',
        at: '2026-07-21T12:00:00.000Z',
        runId: 'r1',
        runType: 'onboarding',
        employeeName: 'Jane Doe',
        stepTitle: 'Order laptop',
      },
    ]
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ events }), { status: 200 }))

    const result = await fetchActivity()

    expect(result).toEqual(events)
  })

  it("throws an ApiError carrying the server's code on an error response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Admin access required.' }), {
        status: 403,
      }),
    )

    const err = (await fetchActivity().catch((e: unknown) => e)) as ApiError

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
    expect(err.message).toBe('Admin access required.')
  })
})
