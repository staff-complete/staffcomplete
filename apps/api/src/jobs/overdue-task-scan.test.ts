import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  innerJoinMock: vi.fn(),
  selectWhereMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  sendAuthEmailMock: vi.fn(),
  resolveAssigneeEmailMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: { select: mocks.selectMock, update: mocks.updateMock },
}))

vi.mock('../auth.js', () => ({
  sendAuthEmail: mocks.sendAuthEmailMock,
  escapeHtml: (value: string) => value,
}))

vi.mock('../lib/task-notifications.js', () => ({
  resolveAssigneeEmail: mocks.resolveAssigneeEmailMock,
  buildOverdueEmail: (input: { taskTitle: string; dueDate: string | null }) => ({
    subject: `Overdue task: ${input.taskTitle}`,
    html: `<p>${input.taskTitle} was due ${input.dueDate}</p>`,
  }),
}))

const { runOverdueTaskScan } = await import('./overdue-task-scan.js')

const NOW = new Date('2026-08-10T13:00:00Z')

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    title: 'Order laptop',
    assigneeId: 'm1',
    // eventDate + 1 day = 2026-08-02, five days before NOW.
    dueDateOffsetDays: 1,
    employeeName: 'Jane Doe',
    eventDate: '2026-08-01',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)

  mocks.selectWhereMock.mockReset().mockResolvedValue([candidate()])
  mocks.innerJoinMock.mockReset().mockReturnValue({ where: mocks.selectWhereMock })
  mocks.fromMock.mockReset().mockReturnValue({ innerJoin: mocks.innerJoinMock })
  mocks.selectMock.mockReset().mockReturnValue({ from: mocks.fromMock })
  mocks.updateWhereMock.mockReset().mockResolvedValue(undefined)
  mocks.updateSetMock.mockReset().mockReturnValue({ where: mocks.updateWhereMock })
  mocks.updateMock.mockReset().mockReturnValue({ set: mocks.updateSetMock })
  mocks.sendAuthEmailMock.mockReset().mockResolvedValue({ error: null })
  mocks.resolveAssigneeEmailMock.mockReset().mockResolvedValue('owner@example.com')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runOverdueTaskScan', () => {
  it('emails the assignee of a task past its due date and stamps it reminded', async () => {
    await runOverdueTaskScan()

    expect(mocks.sendAuthEmailMock).toHaveBeenCalledWith(
      'owner@example.com',
      'Overdue task: Order laptop',
      '<p>Order laptop was due 2026-08-02</p>',
    )
    expect(mocks.updateSetMock).toHaveBeenCalledWith({ overdueNotifiedAt: expect.any(Date) })
  })

  // The due date is derived from run.eventDate rather than stored, so the SQL
  // filter can't apply it — this is the check that has to happen in memory.
  it('leaves a task that is not yet due alone', async () => {
    mocks.selectWhereMock.mockResolvedValue([
      candidate({ eventDate: '2026-08-20', dueDateOffsetDays: 1 }),
    ])

    await runOverdueTaskScan()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.updateSetMock).not.toHaveBeenCalled()
  })

  it('keeps going after one task fails, and still reminds the others', async () => {
    mocks.selectWhereMock.mockResolvedValue([candidate({ id: 's1' }), candidate({ id: 's2' })])
    mocks.sendAuthEmailMock
      .mockResolvedValueOnce({ error: { message: 'rate limited' } })
      .mockResolvedValueOnce({ error: null })

    await expect(runOverdueTaskScan()).resolves.toBeUndefined()

    expect(mocks.sendAuthEmailMock).toHaveBeenCalledTimes(2)
    // Only the task that actually got its email is stamped; the failed one
    // stays un-stamped and is picked up again by tomorrow's scan.
    expect(mocks.updateSetMock).toHaveBeenCalledTimes(1)
  })

  it('skips a task whose assignee no longer has an email', async () => {
    mocks.resolveAssigneeEmailMock.mockResolvedValue(null)

    await runOverdueTaskScan()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
    expect(mocks.updateSetMock).not.toHaveBeenCalled()
  })

  it('returns quietly when the candidate query fails', async () => {
    mocks.selectWhereMock.mockRejectedValue(new Error('connection reset'))

    await expect(runOverdueTaskScan()).resolves.toBeUndefined()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })

  it('does nothing when no tasks are outstanding', async () => {
    mocks.selectWhereMock.mockResolvedValue([])

    await runOverdueTaskScan()

    expect(mocks.sendAuthEmailMock).not.toHaveBeenCalled()
  })
})
