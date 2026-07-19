import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  startTrialIfNeededMock: vi.fn(),
}))

vi.mock('./db/index.js', () => ({
  db: { query: { member: { findFirst: mocks.findFirstMock } } },
}))

vi.mock('./billing/start-trial.js', () => ({
  startTrialIfNeeded: mocks.startTrialIfNeededMock,
}))

const { escapeHtml, handleSessionCreate } = await import('./auth.js')

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml(`<script>alert("hi") & 'bye'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;hi&quot;) &amp; &#39;bye&#39;&lt;/script&gt;',
    )
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('Ada Lovelace')).toBe('Ada Lovelace')
  })
})

describe('handleSessionCreate', () => {
  beforeEach(() => {
    mocks.findFirstMock.mockReset()
    mocks.startTrialIfNeededMock.mockReset().mockResolvedValue(undefined)
  })

  it('does nothing when the user has no membership', async () => {
    mocks.findFirstMock.mockResolvedValue(null)

    const result = await handleSessionCreate({ userId: 'user-1' })

    expect(result).toBeUndefined()
    expect(mocks.startTrialIfNeededMock).not.toHaveBeenCalled()
  })

  it('starts a trial for the membership and sets the active organization', async () => {
    mocks.findFirstMock.mockResolvedValue({ organizationId: 'org-1' })

    const result = await handleSessionCreate({ userId: 'user-1' })

    expect(mocks.startTrialIfNeededMock).toHaveBeenCalledWith('org-1')
    expect(result).toEqual({ data: { activeOrganizationId: 'org-1' } })
  })

  it('does not block session creation when starting the trial fails', async () => {
    mocks.findFirstMock.mockResolvedValue({ organizationId: 'org-1' })
    mocks.startTrialIfNeededMock.mockRejectedValue(new Error('db unavailable'))

    const result = await handleSessionCreate({ userId: 'user-1' })

    expect(result).toEqual({ data: { activeOrganizationId: 'org-1' } })
  })
})
