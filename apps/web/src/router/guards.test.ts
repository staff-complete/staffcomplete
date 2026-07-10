import type { RouteLocationNormalized } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { requireAuth } from './guards'

function toRoute(requiresAuth: boolean, fullPath = '/dashboard'): RouteLocationNormalized {
  return { meta: { requiresAuth }, fullPath } as RouteLocationNormalized
}

describe('requireAuth', () => {
  it('allows navigation when the route does not require auth', async () => {
    const getSession = () => Promise.resolve({ data: null })

    const result = await requireAuth(toRoute(false), getSession)

    expect(result).toBe(true)
  })

  it('allows navigation when a session exists', async () => {
    const getSession = () => Promise.resolve({ data: { user: { email: 'jane@company.com' } } })

    const result = await requireAuth(toRoute(true), getSession)

    expect(result).toBe(true)
  })

  it('redirects to sign-in with the original path when unauthenticated', async () => {
    const getSession = () => Promise.resolve({ data: null })

    const result = await requireAuth(toRoute(true, '/dashboard'), getSession)

    expect(result).toEqual({ name: 'sign-in', query: { redirect: '/dashboard' } })
  })
})
