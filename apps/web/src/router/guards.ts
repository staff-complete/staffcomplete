import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

export async function requireAuth(
  to: RouteLocationNormalized,
  getSession: () => Promise<{ data: unknown }>,
): Promise<RouteLocationRaw | true> {
  if (!to.meta.requiresAuth) return true

  const { data } = await getSession()
  if (!data) {
    return { name: 'sign-in', query: { redirect: to.fullPath } }
  }

  return true
}
