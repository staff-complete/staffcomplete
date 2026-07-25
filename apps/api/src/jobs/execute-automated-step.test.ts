import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runStepFindFirstMock: vi.fn(),
  runFindFirstMock: vi.fn(),
  sendAuthEmailMock: vi.fn(),
  completeRunStepMock: vi.fn(),
  dispatchAutomatedStepsMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      runStep: { findFirst: mocks.runStepFindFirstMock },
      run: { findFirst: mocks.runFindFirstMock },
    },
  }
}

vi.mock('../db/index.js', () => ({
  withTenant: async (_organizationId: string, fn: (t: unknown) => unknown) => fn(tx()),
}))

// Not a passthrough: real escaping (not auth.ts's own module, which would
// pull in betterAuth's full init — see the escaping-regression test below,
// which needs to actually observe `<`/`&`/etc. getting escaped). Mirrors
// auth.ts's own escapeHtml implementation.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
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
}

vi.mock('../auth.js', () => ({
  sendAuthEmail: mocks.sendAuthEmailMock,
  escapeHtml,
}))

vi.mock('../lib/run-steps.js', () => ({
  completeRunStep: mocks.completeRunStepMock,
  dispatchAutomatedSteps: mocks.dispatchAutomatedStepsMock,
}))

const { executeAutomatedStep } = await import('./execute-automated-step.js')

const RUN = {
  id: 'r1',
  employeeName: 'Jane Doe',
  employeeEmail: 'jane@example.com',
  employeeRole: 'Engineer',
  eventDate: '2026-08-01',
}

const EMAIL_STEP = {
  id: 's1',
  runId: 'r1',
  type: 'automated',
  status: 'pending',
  action: 'email.send',
  config: { to: '[employeeEmail]', subject: 'Welcome!', body: 'Hi [employeeName]' },
}

const PAYLOAD = { runStepId: 's1', organizationId: 'org-1' }

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mocks.runStepFindFirstMock.mockReset()
  mocks.runFindFirstMock.mockReset().mockResolvedValue(RUN)
  mocks.sendAuthEmailMock.mockReset().mockResolvedValue({ data: { id: 'email-1' }, error: null })
  mocks.completeRunStepMock.mockReset().mockResolvedValue({ stepsToDispatch: [] })
  mocks.dispatchAutomatedStepsMock.mockReset().mockResolvedValue(undefined)
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

describe('executeAutomatedStep', () => {
  it('sends the email, substituting tokens into to/subject/body, then completes the step and dispatches the cascade', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue(EMAIL_STEP)
    mocks.completeRunStepMock.mockResolvedValue({
      stepsToDispatch: [{ id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' }],
    })

    await executeAutomatedStep(PAYLOAD)

    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'jane@example.com',
      'Welcome!',
      expect.stringContaining('Hi Jane Doe'),
    )
    expect(mocks.completeRunStepMock).toHaveBeenCalledWith(expect.anything(), 's1')
    expect(mocks.dispatchAutomatedStepsMock).toHaveBeenCalledWith('org-1', [
      { id: 's2', phaseId: 'p2', type: 'automated', status: 'pending' },
    ])
  })

  // This test's fixture and assertions deliberately contain unescaped-
  // looking markup to prove it gets escaped — static analysis can't tell
  // that apart from a real vulnerability, hence the nosemgrep comments below.
  it('escapes HTML-special characters an admin typed into the body template, not just the substituted values', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue({
      ...EMAIL_STEP,
      config: {
        to: '[employeeEmail]',
        subject: 'Welcome!',
        body: '<script>steal()</script> Hi [employeeName] & welcome', // nosemgrep
      },
    })

    await executeAutomatedStep(PAYLOAD)

    const html = mocks.sendAuthEmailMock.mock.calls[0][2] as string
    expect(html).not.toContain('<script>') // nosemgrep
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;') // nosemgrep
    expect(html).toContain('Hi Jane Doe &amp; welcome') // nosemgrep
  })

  it('throws when Resend returns an error, so pg-boss retries', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue(EMAIL_STEP)
    mocks.sendAuthEmailMock.mockResolvedValue({ data: null, error: { message: 'outage' } })

    await expect(executeAutomatedStep(PAYLOAD)).rejects.toThrow('outage')

    expect(mocks.completeRunStepMock).not.toHaveBeenCalled()
  })

  it('throws a clear error when sendAuthEmail itself rejects, so pg-boss retries', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue(EMAIL_STEP)
    mocks.sendAuthEmailMock.mockRejectedValue(new Error('network down'))

    await expect(executeAutomatedStep(PAYLOAD)).rejects.toThrow('network down')

    expect(mocks.completeRunStepMock).not.toHaveBeenCalled()
  })

  it('is a no-op when the step no longer exists', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue(undefined)

    await executeAutomatedStep(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.completeRunStepMock).not.toHaveBeenCalled()
  })

  it('is a no-op when the step is already completed (idempotency guard)', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue({ ...EMAIL_STEP, status: 'completed' })

    await executeAutomatedStep(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.completeRunStepMock).not.toHaveBeenCalled()
  })

  it('logs and does not retry when the step has no valid registered action', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue({ ...EMAIL_STEP, action: 'not.a.real.action' })

    await executeAutomatedStep(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('logs and does not retry when config fails validation for its action', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue({ ...EMAIL_STEP, config: { to: '' } })

    await executeAutomatedStep(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('is a no-op when the parent run no longer exists', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue(EMAIL_STEP)
    mocks.runFindFirstMock.mockResolvedValue(undefined)

    await executeAutomatedStep(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })
})
