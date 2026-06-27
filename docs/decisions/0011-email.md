# ADR-0011: Transactional Email

- **Status:** accepted
- **Date:** 2026-06-27

## Context

Lifecycle events trigger email notifications — onboarding welcome emails, access change confirmations, offboarding summaries. A reliable transactional email provider is needed.

## Decision

Use **Resend** — a developer-focused transactional email API with a generous free tier, excellent TypeScript SDK, and React Email support for templating.

## Consequences

- Email delivery depends on Resend's infrastructure — monitor deliverability and have a fallback provider in mind (Postmark, SendGrid) if needed
- SPF, DKIM, and DMARC DNS records must be configured for the sending domain
- Email templates are defined in code using React Email or plain HTML
