import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('throws on an unexpected error response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchActivity()).rejects.toThrow('Failed to load activity')
  })
})
