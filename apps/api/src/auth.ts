import { eq } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins/organization'
import { Resend } from 'resend'
import { DEFAULT_LOCALE } from '@staffcomplete/shared'
import { startTrialIfNeeded } from './billing/start-trial.js'
import { db } from './db/index.js'
import * as schema from './db/schema.js'

const SEVENTY_TWO_HOURS_IN_SECONDS = 72 * 60 * 60

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

// The organization plugin never sets activeOrganizationId itself outside of
// a couple of endpoints that already have a live session in hand (e.g.
// accept-invitation). Every other new session — a plain sign-in being the
// common case — would otherwise start with no active organization at all,
// breaking every org-scoped route. Default it to the user's first
// membership; this is a one-org-per-user assumption that holds until the
// org switcher (ADR-0014) lets someone pick.
//
// This also doubles as the "first login after sign-up" hook (ADR-0015):
// it fires on every new session, and startTrialIfNeeded is itself
// idempotent, so there's no separate "is this actually the first login"
// check needed here.
export async function handleSessionCreate(session: { userId: string }) {
  const membership = await db.query.member.findFirst({
    where: eq(schema.member.userId, session.userId),
    columns: { organizationId: true },
  })
  if (!membership) {
    return
  }
  try {
    await startTrialIfNeeded(membership.organizationId)
  } catch (err) {
    // Never let a trial-start hiccup block someone from signing in.
    console.error('startTrialIfNeeded failed', err)
  }
  return { data: { activeOrganizationId: membership.organizationId } }
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
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
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
  databaseHooks: {
    session: {
      create: {
        before: handleSessionCreate,
      },
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
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
  plugins: [
    organization({
      invitationExpiresIn: SEVENTY_TWO_HOURS_IN_SECONDS,
      schema: {
        organization: {
          additionalFields: {
            locale: {
              type: 'string',
              required: false,
              defaultValue: DEFAULT_LOCALE,
              input: true,
            },
          },
        },
      },
      sendInvitationEmail: async ({ email, invitation, organization: org }) => {
        const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
        const acceptUrl = `${appUrl}/accept-invite?token=${invitation.id}`
        const companyName = escapeHtml(org.name)
        await sendAuthEmail(
          email,
          `You've been invited to join ${companyName} on StaffComplete`,
          `
            <p>You've been invited to join <strong>${companyName}</strong> on StaffComplete as ${invitation.role === 'admin' ? 'an admin' : 'a team member'}.</p>
            <p><a href="${acceptUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invite</a></p>
            <p>This link expires in 72 hours. If you weren't expecting this invite, you can safely ignore this email.</p>
          `,
        )
      },
    }),
  ],
})
