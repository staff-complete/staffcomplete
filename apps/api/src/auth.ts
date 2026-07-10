import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Resend } from 'resend'
import { db } from './db/index.js'
import * as schema from './db/schema.js'

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

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.AUTH_SECRET ?? 'dev-secret-change-in-production',
  trustedOrigins: [process.env.APP_URL ?? 'http://localhost:5173'],
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
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const safeUrl = url.replace(/&/g, '&amp;')
      await resend.emails.send({
        // nosemgrep: the angle brackets are a mailbox "Name <email>" header, not HTML
        from: 'StaffComplete <noreply@staffcomplete.io>',
        to: user.email,
        subject: 'Verify your email address',
        html: `
          <p>Hi ${escapeHtml(user.name)},</p>
          <p>Click the link below to verify your email address and activate your StaffComplete account.</p>
          <p><a href="${safeUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify email</a></p>
          <p>This link expires in 24 hours. If you did not sign up, you can safely ignore this email.</p>
        `,
      })
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
