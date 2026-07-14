import type { RouteLocationNormalized } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { requireAuth } from './guards'

function toRoute(
  requiresAuth: boolean,
  fullPath = '/dashboard',
  requiresAdmin = false,
): RouteLocationNormalized {
  return { meta: { requiresAuth, requiresAdmin }, fullPath } as RouteLocationNormalized
}

function memberRole(role: string | null) {
  return () => Promise.resolve({ data: role ? { role } : null })
}

const notAskedForRole = () => Promise.reject(new Error('should not be called'))

describe('requireAuth', () => {
  it('allows navigation when the route does not require auth', async () => {
    const getSession = () => Promise.resolve({ data: null })

    const result = await requireAuth(toRoute(false), getSession, notAskedForRole)

    expect(result).toBe(true)
  })

  it('allows navigation when a session exists', async () => {
    const getSession = () => Promise.resolve({ data: { user: { email: 'jane@company.com' } } })

    const result = await requireAuth(toRoute(true), getSession, notAskedForRole)

    expect(result).toBe(true)
  })

  it('redirects to sign-in with the original path when unauthenticated', async () => {
    const getSession = () => Promise.resolve({ data: null })

    const result = await requireAuth(toRoute(true, '/dashboard'), getSession, notAskedForRole)

    expect(result).toEqual({ name: 'sign-in', query: { redirect: '/dashboard' } })
  })

  it('allows an admin onto a requiresAdmin route', async () => {
    const getSession = () => Promise.resolve({ data: { user: { email: 'jane@company.com' } } })

    const result = await requireAuth(toRoute(true, '/team', true), getSession, memberRole('admin'))

    expect(result).toBe(true)
  })

  it('allows an owner onto a requiresAdmin route', async () => {
    const getSession = () => Promise.resolve({ data: { user: { email: 'jane@company.com' } } })

    const result = await requireAuth(toRoute(true, '/team', true), getSession, memberRole('owner'))

    expect(result).toBe(true)
  })

  it('redirects a non-admin away from a requiresAdmin route', async () => {
    const getSession = () => Promise.resolve({ data: { user: { email: 'jane@company.com' } } })

    const result = await requireAuth(toRoute(true, '/team', true), getSession, memberRole('member'))

    expect(result).toEqual({ name: 'dashboard' })
  })
})
