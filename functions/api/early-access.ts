import { earlyAccessSignupSchema } from '@staffcomplete/shared'

interface Env {
  /** Resend API key. Without it the endpoint has nowhere to deliver a signup. */
  RESEND_API_KEY: string
  /** Inbox that receives the notifications — this is the whole signup store. */
  EARLY_ACCESS_TO: string
  /** Verified Resend sender. */
  EARLY_ACCESS_FROM: string
  /** Optional: when set, submissions must carry a valid Turnstile token. */
  TURNSTILE_SECRET_KEY?: string
}

interface RequestContext {
  request: Request
  env: Env
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const RESEND_SEND_URL = 'https://api.resend.com/emails'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function passesTurnstile(
  secret: string,
  token: unknown,
  ip: string | null,
): Promise<boolean> {
  if (typeof token !== 'string' || token === '') return false

  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  const response = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: form })
  if (!response.ok) return false

  const outcome = (await response.json()) as { success?: boolean }
  return outcome.success === true
}

export async function onRequestPost({ request, env }: RequestContext): Promise<Response> {
  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  // Honeypot: the field is hidden from real people, so anything in it is a bot.
  // Answer as if it worked: an error only tells a bot what to change and retry.
  if (typeof payload.website === 'string' && payload.website !== '') {
    return json({ ok: true }, 200)
  }

  const ip = request.headers.get('cf-connecting-ip')
  if (env.TURNSTILE_SECRET_KEY) {
    if (!(await passesTurnstile(env.TURNSTILE_SECRET_KEY, payload.turnstileToken, ip))) {
      return json({ error: 'Could not verify that you are human. Please try again.' }, 400)
    }
  }

  const parsed = earlyAccessSignupSchema.safeParse(payload)
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400)
  }

  const { email, company } = parsed.data
  const lines = [
    `Email:     ${email}`,
    `Company:   ${company ?? '—'}`,
    `Submitted: ${new Date().toISOString()}`,
    `Country:   ${request.headers.get('cf-ipcountry') ?? '—'}`,
  ]

  const sent = await fetch(RESEND_SEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EARLY_ACCESS_FROM,
      to: [env.EARLY_ACCESS_TO],
      reply_to: [email],
      subject: `Early access: ${email}`,
      text: lines.join('\n'),
    }),
  })

  if (!sent.ok) {
    console.error('resend rejected an early-access notification', {
      status: sent.status,
      body: await sent.text(),
    })
    return json({ error: 'Could not record your request. Please try again shortly.' }, 502)
  }

  return json({ ok: true }, 200)
}
