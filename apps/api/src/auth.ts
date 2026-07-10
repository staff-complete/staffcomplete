import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Resend } from 'resend'
import { db } from './db/index.js'
import * as schema from './db/schema.js'

const AUTH_EMAIL_FROM = 'noreply@staffcomplete.io'
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })

export const sendAuthEmail = (to: string, subject: string, html: string) => {
  const resend = new Resend(process.env.RESEND_API_KEY)
  return resend.emails.send({ from: AUTH_EMAIL_FROM, to, subject, html })
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.AUTH_SECRET ?? 'dev-secret-change-in-production',
  trustedOrigins: [process.env.APP_URL ?? 'http://localhost:5173'],
  advanced: {
    // Without this, request-password-reset awaits the Resend API call before
    // responding, making existing accounts measurably slower than unknown
    // ones and leaking account existence through response timing.
    backgroundTasks: {
      handler: (promise) => {
        void promise
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const safeUrl = url.replace(/&/g, '&amp;')
      await sendAuthEmail(
        user.email,
        'Reset your password',
        `
          <p>Hi ${escapeHtml(user.name)},</p>
          <p>We received a request to reset your StaffComplete password. Click the link below to choose a new one.</p>
          <p><a href="${safeUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
          <p>This link expires in 1 hour and can only be used once. If you did not request this, you can safely ignore this email.</p>
        `,
      )
    },
  },
  session: {
    expiresIn: Number(process.env.SESSION_EXPIRES_IN_SECONDS ?? SEVEN_DAYS_IN_SECONDS),
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const safeUrl = url.replace(/&/g, '&amp;')
      await sendAuthEmail(
        user.email,
        'Verify your email address',
        `
          <p>Hi ${escapeHtml(user.name)},</p>
          <p>Click the link below to verify your email address and activate your StaffComplete account.</p>
          <p><a href="${safeUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify email</a></p>
          <p>This link expires in 24 hours. If you did not sign up, you can safely ignore this email.</p>
        `,
      )
    },
  },
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        required: false,
        fieldName: 'tenantId',
        input: false,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'admin',
        fieldName: 'role',
        input: false,
      },
    },
  },
})
