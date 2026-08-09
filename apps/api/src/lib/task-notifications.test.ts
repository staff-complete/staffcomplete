import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  innerJoinMock: vi.fn(),
  whereMock: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
  db: { select: mocks.selectMock },
}))

// Marks its argument rather than escaping it, so the assertions below can
// tell apart "this field was passed through escapeHtml" from "this field
// happened to contain no special characters" — the distinction that matters
// for the HTML body vs. the plain-text subject.
vi.mock('../auth.js', () => ({
  escapeHtml: (value: string) => `ESC(${value})`,
}))

const { buildAssignmentEmail, buildOverdueEmail, resolveAssigneeEmail } =
  await import('./task-notifications.js')

const input = {
  employeeName: 'Jane Doe',
  taskTitle: 'Order laptop',
  dueDate: '2026-08-20',
}

describe('resolveAssigneeEmail', () => {
  beforeEach(() => {
    mocks.whereMock.mockReset()
    mocks.innerJoinMock.mockReset().mockReturnValue({ where: mocks.whereMock })
    mocks.fromMock.mockReset().mockReturnValue({ innerJoin: mocks.innerJoinMock })
    mocks.selectMock.mockReset().mockReturnValue({ from: mocks.fromMock })
  })

  it("returns the member's login email", async () => {
    mocks.whereMock.mockResolvedValue([{ email: 'owner@example.com' }])
    await expect(resolveAssigneeEmail('member-1', 'org-1')).resolves.toBe('owner@example.com')
  })

  it('returns null when the member no longer exists', async () => {
    mocks.whereMock.mockResolvedValue([])
    await expect(resolveAssigneeEmail('member-gone', 'org-1')).resolves.toBeNull()
  })

  // This lookup runs on the superuser connection, so the organizationId
  // filter is the only tenant boundary it has — a member id belonging to
  // another organization must resolve to nothing rather than to their email.
  it('scopes the lookup to the organization, not the member id alone', async () => {
    mocks.whereMock.mockResolvedValue([])

    await expect(resolveAssigneeEmail('member-of-other-org', 'org-1')).resolves.toBeNull()

    // drizzle's and(...) builds a SQL object with circular references, so walk
    // it collecting column names rather than serializing it.
    const columnNames = new Set<string>()
    const seen = new Set<unknown>()
    const walk = (value: unknown) => {
      if (value === null || typeof value !== 'object' || seen.has(value)) {
        return
      }
      seen.add(value)
      const record = value as Record<string, unknown>
      if (typeof record.name === 'string') {
        columnNames.add(record.name)
      }
      for (const child of Object.values(record)) {
        walk(child)
      }
    }
    walk(mocks.whereMock.mock.calls[0][0])

    expect(columnNames).toContain('organizationId')
    expect(columnNames).toContain('id')
  })
})

describe('task email builders', () => {
  const originalAppUrl = process.env.APP_URL

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL
    } else {
      process.env.APP_URL = originalAppUrl
    }
  })

  it('states the employee, the task and the due date on assignment', () => {
    const { subject, html } = buildAssignmentEmail(input)
    expect(subject).toBe('New task: Order laptop')
    expect(html).toContain('ESC(Jane Doe)')
    expect(html).toContain('ESC(Order laptop)')
    expect(html).toContain('Due <strong>2026-08-20</strong>')
  })

  it('says the task is late on the overdue reminder', () => {
    const { subject, html } = buildOverdueEmail(input)
    expect(subject).toBe('Overdue task: Order laptop')
    expect(html).toContain('past its due date')
    expect(html).toContain('ESC(Jane Doe)')
    expect(html).toContain('ESC(Order laptop)')
  })

  it('omits the due line entirely when the step has no due date', () => {
    const html = buildAssignmentEmail({ ...input, dueDate: null }).html
    expect(html).not.toContain('Due <strong>')
    expect(html).toContain('ESC(Order laptop)')
  })

  it('links to My Tasks at the configured app URL', () => {
    process.env.APP_URL = 'https://app.staffcomplete.io'
    expect(buildAssignmentEmail(input).html).toContain('href="https://app.staffcomplete.io/tasks"')
    expect(buildOverdueEmail(input).html).toContain('href="https://app.staffcomplete.io/tasks"')
  })

  it('falls back to the local app URL when APP_URL is unset', () => {
    delete process.env.APP_URL
    expect(buildAssignmentEmail(input).html).toContain('href="http://localhost:5173/tasks"')
  })

  // The subject is plain text, not HTML — escaping it would surface literal
  // &amp; entities in the assignee's inbox. Only the body is escaped.
  it('escapes user-authored content in the body but not in the subject', () => {
    const hostile = {
      employeeName: '<script>alert(1)</script>',
      taskTitle: 'Ben & Jerry onboarding',
      dueDate: null,
    }
    const { subject, html } = buildAssignmentEmail(hostile)
    expect(subject).toBe('New task: Ben & Jerry onboarding')
    expect(html).toContain('ESC(<script>alert(1)</script>)')
    expect(html).toContain('ESC(Ben & Jerry onboarding)')
  })
})
