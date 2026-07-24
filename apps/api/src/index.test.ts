import { describe, expect, it } from 'vitest'

describe('api', () => {
  it('loads', async () => {
    await import('./index.js')
  })

  // Regression guard: Hono's RegExpRouter throws UnsupportedPathError on
  // certain route shapes (e.g. a literal segment and a :param sitting at the
  // same depth under the same HTTP method — see the comment on
  // workflowsRouter's phase-order route). When that happens, SmartRouter
  // silently falls back to TrieRouter for the *entire* app, which resolves
  // the /api/auth/** wildcard mount differently and broke sign-in/sign-up
  // outright — with no error anywhere, only a 404 on every auth route. This
  // wouldn't be caught by "loads" above (that only checks the module
  // imports), so it needs an actual route-match assertion.
  it('resolves the /api/auth/** wildcard mount alongside every other registered route', async () => {
    const { app } = await import('./index.js')
    const res = await app.request('/api/auth/get-session')
    expect(res.status).not.toBe(404)
  })
})
