import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './early-access.js'

const env = {
  RESEND_API_KEY: 'test-key',
  EARLY_ACCESS_TO: 'founder@staffcomplete.io',
  // Codacy's xss/no-mixed-html reads the angle brackets of an RFC 5322
  // display-name address as raw HTML. This is a Resend `from` header, not
  // markup bound into a DOM, and it mirrors what production actually holds.
  // eslint-disable-next-line xss/no-mixed-html
  EARLY_ACCESS_FROM: 'Early Access <early-access@staffcomplete.io>',
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://staffcomplete.io/api/early-access', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** Resend accepting the send — the happy path for every non-Resend assertion. */
function resendAccepts() {
  return vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
  )
}

/** The arguments of one recorded fetch call, which the mock always receives. */
function callArgs(mock: ReturnType<typeof resendAccepts>, index: number) {
  const call = mock.mock.calls.at(index)
  if (!call) throw new Error(`expected a fetch call at index ${index}`)
  const body = call[1]?.body
  return { url: call[0], body: JSON.parse(typeof body === 'string' ? body : '{}') }
}

let fetchMock: ReturnType<typeof resendAccepts>

beforeEach(() => {
  fetchMock = resendAccepts()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('onRequestPost', () => {
  it('emails the request and reports success', async () => {
    const response = await onRequestPost({
      request: postRequest({ email: 'ada@example.com' }),
      env,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const { url, body: sent } = callArgs(fetchMock, 0)
    expect(url).toBe('https://api.resend.com/emails')
    expect(sent.to).toEqual(['founder@staffcomplete.io'])
    expect(sent.reply_to).toEqual(['ada@example.com'])
    expect(sent.subject).toBe('Early access: ada@example.com')
    expect(sent.text).toContain('ada@example.com')
  })

  it('includes the company and country when present', async () => {
    await onRequestPost({
      request: postRequest(
        { email: 'ada@example.com', company: 'Analytical Engines' },
        { 'cf-ipcountry': 'GB' },
      ),
      env,
    })

    const { body: sent } = callArgs(fetchMock, 0)
    expect(sent.text).toContain('Analytical Engines')
    expect(sent.text).toContain('GB')
  })

  it('rejects a body that is not JSON', async () => {
    const response = await onRequestPost({ request: postRequest('not json'), env })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Expected a JSON body' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid email with the schema message', async () => {
    const response = await onRequestPost({ request: postRequest({ email: 'ada@' }), env })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Valid work email required' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('silently drops a request that filled the honeypot', async () => {
    const response = await onRequestPost({
      request: postRequest({ email: 'ada@example.com', website: 'http://spam.example' }),
      env,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trims whitespace off the API key before authenticating', async () => {
    await onRequestPost({
      request: postRequest({ email: 'ada@example.com' }),
      env: { ...env, RESEND_API_KEY: '  test-key\n' },
    })

    const call = fetchMock.mock.calls.at(0)
    const headers = call?.[1]?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer test-key')
  })

  it('reports a failure when Resend rejects the send', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await onRequestPost({
      request: postRequest({ email: 'ada@example.com' }),
      env,
    })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Could not record your request. Please try again shortly.',
    })
  })

  describe('with Turnstile configured', () => {
    const guardedEnv = { ...env, TURNSTILE_SECRET_KEY: 'turnstile-secret' }

    it('rejects a submission with no token before emailing', async () => {
      const response = await onRequestPost({
        request: postRequest({ email: 'ada@example.com' }),
        env: guardedEnv,
      })

      expect(response.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects a submission Turnstile does not verify', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false })))

      const response = await onRequestPost({
        request: postRequest({ email: 'ada@example.com', turnstileToken: 'bad' }),
        env: guardedEnv,
      })

      expect(response.status).toBe(400)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('emails the request once Turnstile verifies it', async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true })))

      const response = await onRequestPost({
        request: postRequest({ email: 'ada@example.com', turnstileToken: 'good' }),
        env: guardedEnv,
      })

      expect(response.status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(callArgs(fetchMock, 1).url).toBe('https://api.resend.com/emails')
    })
  })
})
