import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { auth } from '../auth.js'
import { db } from '../db/index.js'
import { tenant, user } from '../db/schema.js'

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

export const onboardRouter = new Hono()

onboardRouter.post('/', zValidator('json', signUpSchema), async (c) => {
  const { name, email, password, company } = c.req.valid('json')

  // Check for duplicate email before creating tenant
  const existing = await db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
    columns: { id: true },
  })

  if (existing) {
    return c.json(
      { code: 'EMAIL_IN_USE', message: 'An account with this email already exists.' },
      409,
    )
  }

  // Create tenant first
  const tenantId = crypto.randomUUID()
  await db.insert(tenant).values({ id: tenantId, name: company })

  // Register user via Better Auth
  const signUpResponse = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: process.env.APP_URL ?? 'http://localhost:5173' },
    asResponse: true,
  })

  if (!signUpResponse.ok) {
    // Clean up the tenant we just created
    await db.delete(tenant).where(eq(tenant.id, tenantId))
    const error = (await signUpResponse.json()) as { message?: string }
    return c.json(
      { code: 'SIGNUP_FAILED', message: error.message ?? 'Sign up failed. Please try again.' },
      signUpResponse.status as 400 | 422 | 500,
    )
  }

  const data = (await signUpResponse.json()) as { user?: { id: string } }
  const userId = data.user?.id

  if (userId) {
    await db.update(user).set({ tenantId }).where(eq(user.id, userId))
  }

  return c.json({ status: 'pending_verification' }, 201)
})
