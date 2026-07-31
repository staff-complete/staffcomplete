import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, apiFetchOrNull } from './api'

function respond(status: number, body?: unknown, init?: { text?: string }) {
  const payload = init?.text ?? (body === undefined ? '' : JSON.stringify(body))
  const headers = new Headers(body === undefined && !init?.text ? { 'content-length': '0' } : {})
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(status === 204 ? null : payload, {
        status,
        statusText: status === 500 ? 'Internal Server Error' : '',
        headers,
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('returns the parsed body on success', async () => {
    respond(200, { runs: [{ id: 'r1' }] })

    await expect(apiFetch('/api/runs')).resolves.toEqual({ runs: [{ id: 'r1' }] })
  })

  it('passes the request init straight through', async () => {
    respond(201, { id: 'r1' })

    await apiFetch('/api/runs', { method: 'POST', body: '{}' })

    expect(fetch).toHaveBeenCalledWith('/api/runs', { method: 'POST', body: '{}' })
  })

  it("throws ApiError carrying the server's code, message, and status", async () => {
    respond(402, { code: 'TRIAL_EXPIRED', message: 'Your trial has ended. Subscribe to continue.' })

    const err = await apiFetch('/api/checklists', { method: 'POST' }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 402,
      code: 'TRIAL_EXPIRED',
      message: 'Your trial has ended. Subscribe to continue.',
    })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    respond(500, undefined, { text: '<html>gateway error</html>' })

    const err = (await apiFetch('/api/runs').catch((e: unknown) => e)) as ApiError

    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('UNKNOWN')
    expect(err.message).toBe('Internal Server Error')
  })

  it('does not try to parse a 204 as JSON', async () => {
    respond(204)

    await expect(apiFetch('/api/tasks/1/complete', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('lets a network failure propagate as-is, not as an ApiError', async () => {
    const networkFailure = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkFailure))

    const err = await apiFetch('/api/runs').catch((e: unknown) => e)

    // Callers distinguish these to pick between the server's own message and
    // a localized "couldn't reach the server" string.
    expect(err).toBe(networkFailure)
    expect(err).not.toBeInstanceOf(ApiError)
  })
})

describe('apiFetchOrNull', () => {
  it('returns null on 404', async () => {
    respond(404, { code: 'NOT_FOUND', message: 'Run not found.' })

    await expect(apiFetchOrNull('/api/runs/nope')).resolves.toBeNull()
  })

  it('still throws for other error statuses', async () => {
    respond(403, { code: 'FORBIDDEN', message: 'Admin access required.' })

    await expect(apiFetchOrNull('/api/runs/x')).rejects.toBeInstanceOf(ApiError)
  })

  it('returns the body when the request succeeds', async () => {
    respond(200, { id: 'r1' })

    await expect(apiFetchOrNull('/api/runs/r1')).resolves.toEqual({ id: 'r1' })
  })
})
