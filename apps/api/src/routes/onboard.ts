import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { APIError } from 'better-auth/api'
import { auth, escapeHtml, sendAuthEmail } from '../auth.js'
import { db } from '../db/index.js'
import { user } from '../db/schema.js'

const signUpSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid work email required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
})

// Organization slugs must be unique; the random suffix avoids a second
// "Acme Co" signup colliding with the first without asking the user to
// pick one themselves.
function slugify(company: string): string {
  const base = company
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'org'}-${crypto.randomUUID().slice(0, 8)}`
}

export const onboardRouter = new Hono()

onboardRouter.post('/', zValidator('json', signUpSchema), async (c) => {
  const { name, email, password, company } = c.req.valid('json')

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'

  // Check for duplicate email before creating tenant. Responds identically
  // to a real sign-up either way (same status, same body shape) so this
  // endpoint can't be used to enumerate which emails already have accounts.
  // Instead of just going silent, the actual account owner gets a real,
  // actionable email — the requester never learns whether it was sent.
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
    columns: { name: true },
  })

  if (existing) {
    await sendAuthEmail(
      email,
      'Someone tried to sign up with your email',
      `
        <p>Hi ${escapeHtml(existing.name)},</p>
        <p>Someone just tried to create a new StaffComplete account using this email address, but you already have one.</p>
        <p>If this was you, you can <a href="${appUrl}/sign-in">sign in</a> instead, or <a href="${appUrl}/forgot-password">reset your password</a> if you've forgotten it.</p>
        <p>If it wasn't you, no action is needed — your account is unaffected and you can safely ignore this email.</p>
      `,
    )
    return c.json({ status: 'pending_verification' }, 201)
  }

  // Register user via Better Auth. callbackURL is where the verification
  // email's link lands after auto-sign-in — the dashboard, not the bare
  // marketing home page, since they're authenticated at that point.
  const signUpResponse = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: `${appUrl}/dashboard` },
    asResponse: true,
  })

  if (!signUpResponse.ok) {
    const error = (await signUpResponse.json()) as { message?: string }
    return c.json(
      { code: 'SIGNUP_FAILED', message: error.message ?? 'Sign up failed. Please try again.' },
      signUpResponse.status as 400 | 422 | 500,
    )
  }

  const data = (await signUpResponse.json()) as { user?: { id: string } }
  const userId = data.user?.id

  if (userId) {
    try {
      // Server-only call (no headers/session): passing userId directly
      // makes this a trusted system action per the plugin's own contract,
      // since there's no session yet — the account isn't verified. The
      // creator becomes the org's 'owner' (Better Auth's default role).
      await auth.api.createOrganization({
        body: { name: company, slug: slugify(company), userId },
      })
    } catch (err) {
      // Clean up the orphaned user rather than leaving an account with no
      // organization to land in.
      await db.delete(user).where(eq(user.id, userId))
      const message = err instanceof APIError ? err.message : 'Sign up failed. Please try again.'
      return c.json({ code: 'SIGNUP_FAILED', message }, 500)
    }
  }

  return c.json({ status: 'pending_verification' }, 201)
})
