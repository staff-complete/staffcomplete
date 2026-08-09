import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runStepFindFirstMock: vi.fn(),
  runFindFirstMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  sendAuthEmailMock: vi.fn(),
  resolveAssigneeEmailMock: vi.fn(),
}))

function tx() {
  return {
    query: {
      runStep: { findFirst: mocks.runStepFindFirstMock },
      run: { findFirst: mocks.runFindFirstMock },
    },
    update: mocks.updateMock,
  }
}

vi.mock('../db/index.js', () => ({
  withTenant: async (_organizationId: string, fn: (t: unknown) => unknown) => fn(tx()),
}))

vi.mock('../auth.js', () => ({
  sendAuthEmail: mocks.sendAuthEmailMock,
  escapeHtml: (value: string) => value,
}))

// The email's wording is task-notifications.test.ts's business; here only the
// orchestration matters — who gets mailed, when, and what is written back.
vi.mock('../lib/task-notifications.js', () => ({
  resolveAssigneeEmail: mocks.resolveAssigneeEmailMock,
  buildAssignmentEmail: (input: { taskTitle: string; dueDate: string | null }) => ({
    subject: `New task: ${input.taskTitle}`,
    html: `<p>${input.taskTitle} due ${input.dueDate}</p>`,
  }),
}))

const { notifyTaskAssignment } = await import('./notify-task-assignment.js')

const PAYLOAD = { runStepId: 's1', organizationId: 'org-1' }

const STEP = {
  id: 's1',
  runId: 'r1',
  type: 'manual',
  status: 'pending',
  title: 'Order laptop',
  assigneeId: 'm1',
  dueDateOffsetDays: 1,
  assignmentNotifiedAt: null,
}

const RUN = { id: 'r1', employeeName: 'Jane Doe', eventDate: '2026-08-01' }

beforeEach(() => {
  mocks.runStepFindFirstMock.mockReset().mockResolvedValue(STEP)
  mocks.runFindFirstMock.mockReset().mockResolvedValue(RUN)
  mocks.updateWhereMock.mockReset().mockResolvedValue(undefined)
  mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
  mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
  mocks.sendAuthEmailMock.mockReset().mockResolvedValue({ error: null })
  mocks.resolveAssigneeEmailMock.mockReset().mockResolvedValue('owner@example.com')
})

describe('notifyTaskAssignment', () => {
  it('emails the assignee and stamps the step as notified', async () => {
    await notifyTaskAssignment(PAYLOAD)

    // Tenant-scoped: the lookup bypasses RLS, so it must be told which org.
    expect(mocks.resolveAssigneeEmailMock).toHaveBeenCalledWith('m1', 'org-1')
    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'owner@example.com',
      'New task: Order laptop',
      // eventDate 2026-08-01 + dueDateOffsetDays 1
      '<p>Order laptop due 2026-08-02</p>',
    )
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ assignmentNotifiedAt: expect.any(Date) })
  })

  it.each([
    ['already notified', { assignmentNotifiedAt: new Date('2026-08-01T09:00:00Z') }],
    ['already completed', { status: 'completed' }],
    ['unassigned since enqueue', { assigneeId: null }],
    ['not a manual step', { type: 'automated' }],
  ])('sends nothing when the step is %s', async (_label, overrides) => {
    mocks.runStepFindFirstMock.mockResolvedValue({ ...STEP, ...overrides })

    await notifyTaskAssignment(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.updateSetMock).not.toHaveBeenCalled()
  })

  it('sends nothing when the step has vanished', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue(undefined)

    await notifyTaskAssignment(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })

  it('sends nothing when the run has vanished', async () => {
    mocks.runFindFirstMock.mockResolvedValue(undefined)

    await notifyTaskAssignment(PAYLOAD)

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })

  // A member deleted between enqueue and execution: retrying can't bring them
  // back, so the job gives up quietly rather than burning its retry budget.
  it('drops the notification when the assignee has no email, without retrying', async () => {
    mocks.resolveAssigneeEmailMock.mockResolvedValue(null)

    await expect(notifyTaskAssignment(PAYLOAD)).resolves.toBeUndefined()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.updateSetMock).not.toHaveBeenCalled()
  })

  // The opposite case: a provider failure must reject so pg-boss retries, and
  // must leave assignmentNotifiedAt null so the retry actually re-sends
  // instead of hitting the idempotency guard.
  it('throws and leaves the step un-stamped when the email provider fails', async () => {
    mocks.sendAuthEmailMock.mockResolvedValue({ error: { message: 'rate limited' } })

    await expect(notifyTaskAssignment(PAYLOAD)).rejects.toThrow('rate limited')

    expect(mocks.updateSetMock).not.toHaveBeenCalled()
  })

  it('leaves the due date null when the step has no offset', async () => {
    mocks.runStepFindFirstMock.mockResolvedValue({ ...STEP, dueDateOffsetDays: null })

    await notifyTaskAssignment(PAYLOAD)

    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'owner@example.com',
      'New task: Order laptop',
      '<p>Order laptop due null</p>',
    )
  })
})
