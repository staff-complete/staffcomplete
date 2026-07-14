import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

// Role now lives per-member (ADR-0014), not on the session's user object, so
// an admin-gated route needs a separate lookup instead of a synchronous
// field read.
export async function requireAuth(
  to: RouteLocationNormalized,
  getSession: () => Promise<{ data: unknown }>,
  getActiveMemberRole: () => Promise<{ data: unknown }>,
): Promise<RouteLocationRaw | true> {
  if (!to.meta.requiresAuth) return true

  const { data } = await getSession()
  if (!data) {
    return { name: 'sign-in', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin) {
    const { data: memberData } = await getActiveMemberRole()
    const role = (memberData as { role?: string } | null)?.role
    if (role !== 'admin' && role !== 'owner') {
      return { name: 'dashboard' }
    }
  }

  return true
}
