import { eq } from 'drizzle-orm'
import {
  isAutomatedActionKey,
  parseAutomatedActionConfig,
  substituteAutomationTokens,
} from '@staffcomplete/shared'
import type { EmailSendConfig } from '@staffcomplete/shared'
import { escapeHtml, sendAuthEmail } from '../auth.js'
import { withTenant } from '../db/index.js'
import { run, runStep } from '../db/schema.js'
import { completeRunStep, dispatchAutomatedSteps } from '../lib/run-steps.js'

export interface ExecuteAutomatedStepPayload {
  runStepId: string
  organizationId: string
}

// Runs an automated step's action (currently just email.send) and, on
// success, marks it completed and dispatches whatever it just unlocked.
// Reads happen in one short transaction, the network call to Resend happens
// outside any transaction (an HTTP call has no business holding a Postgres
// transaction open), and the completion write happens in a second short
// transaction — see apps/api/src/lib/run-steps.ts for why dispatch itself
// only ever runs after a transaction has committed.
export async function executeAutomatedStep(payload: ExecuteAutomatedStepPayload): Promise<void> {
  const { runStepId, organizationId } = payload

  const prepared = await withTenant(organizationId, async (tx) => {
    const step = await tx.query.runStep.findFirst({ where: eq(runStep.id, runStepId) })
    if (!step) {
      console.error(`executeAutomatedStep: run step ${runStepId} not found`)
      return null
    }
    // Idempotency: dispatchAutomatedSteps' singletonKey already stops most
    // duplicate enqueues, this is the second-layer guard — e.g. a retried
    // job landing after an earlier attempt already completed the step.
    if (step.status !== 'pending') {
      return null
    }
    if (step.type !== 'automated' || step.action === null || !isAutomatedActionKey(step.action)) {
      // A step's action is validated against the registry at create/update
      // time, so this means the row and the registry have drifted apart —
      // a data-integrity bug, not a transient failure. Log, don't retry.
      console.error(
        `executeAutomatedStep: run step ${runStepId} has no valid automated action (${step.action})`,
      )
      return null
    }

    const configResult = parseAutomatedActionConfig(step.action, step.config)
    if (!configResult.success) {
      console.error(
        `executeAutomatedStep: run step ${runStepId} has invalid config for ${step.action}`,
        configResult.error,
      )
      return null
    }

    const foundRun = await tx.query.run.findFirst({ where: eq(run.id, step.runId) })
    if (!foundRun) {
      console.error(`executeAutomatedStep: run ${step.runId} not found for step ${runStepId}`)
      return null
    }

    return { action: step.action, config: configResult.data, run: foundRun }
  })

  if (!prepared) {
    return
  }

  // Only one action is registered today — a second one branches here.
  if (prepared.action === 'email.send') {
    await sendEmailAction(prepared.config as EmailSendConfig, prepared.run)
  }

  const { stepsToDispatch } = await withTenant(organizationId, (tx) =>
    completeRunStep(tx, runStepId),
  )
  await dispatchAutomatedSteps(organizationId, stepsToDispatch)
}

async function sendEmailAction(
  config: EmailSendConfig,
  foundRun: typeof run.$inferSelect,
): Promise<void> {
  const tokenValues = {
    employeeName: foundRun.employeeName,
    employeeEmail: foundRun.employeeEmail,
    employeeRole: foundRun.employeeRole,
    eventDate: foundRun.eventDate,
  }
  // `to` substitutes the raw email address — escaping would corrupt it (e.g.
  // if it ever contained `&`). subject/body substitute the escaped
  // name/role, since those land inside an HTML email body.
  const to = substituteAutomationTokens(config.to, tokenValues)
  const subject = substituteAutomationTokens(config.subject, tokenValues)
  const escapedBody = substituteAutomationTokens(config.body, {
    ...tokenValues,
    employeeName: escapeHtml(tokenValues.employeeName),
    employeeRole: escapeHtml(tokenValues.employeeRole),
  })
  const html = `<p>${escapedBody.replaceAll('\n', '<br>')}</p>`

  const result = await sendAuthEmail(to, subject, html)
  if (result.error) {
    // Thrown, not logged-and-returned: this is the transient-failure path
    // (Resend outage, bad API key), so the job handler rejects and pg-boss
    // retries per the retryLimit set in dispatchAutomatedSteps.
    throw new Error(`sendAuthEmail failed for run step: ${result.error.message}`)
  }
}
