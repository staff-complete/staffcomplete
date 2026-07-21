import { createRouter, createWebHistory } from 'vue-router'
import { authClient } from '../lib/auth-client'
import { requireAuth } from './guards'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresAdmin?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/sign-up',
      name: 'sign-up',
      component: () => import('../views/SignUpView.vue'),
    },
    {
      path: '/sign-in',
      name: 'sign-in',
      component: () => import('../views/SignInView.vue'),
    },
    {
      path: '/check-email',
      name: 'check-email',
      component: () => import('../views/CheckEmailView.vue'),
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/ForgotPasswordView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
    },
    {
      path: '/accept-invite',
      name: 'accept-invite',
      component: () => import('../views/AcceptInviteView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/team',
      name: 'team',
      component: () => import('../views/TeamView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/billing',
      name: 'billing',
      component: () => import('../views/BillingView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/workflows',
      name: 'workflows',
      component: () => import('../views/WorkflowsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/workflows/:id',
      name: 'workflow-editor',
      component: () => import('../views/WorkflowEditorView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/runs/:type(onboarding|offboarding)',
      name: 'runs',
      component: () => import('../views/RunsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('../views/MyTasksView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) =>
  requireAuth(
    to,
    () => authClient.getSession(),
    () => authClient.organization.getActiveMemberRole(),
  ),
)

export default router
