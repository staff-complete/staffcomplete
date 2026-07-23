<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, TRIAL_LENGTH_DAYS, type Locale } from '@staffcomplete/shared'
import { authClient } from '../lib/auth-client'
import { useTrialStatus } from '../composables/useTrialStatus'
import { initialsFor } from '../lib/avatarColors'
import AppLogo from '../components/AppLogo.vue'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TodayAtAGlance from '../components/TodayAtAGlance.vue'
import ActivityFeed from '../components/ActivityFeed.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const session = authClient.useSession()
const activeMemberRole = authClient.useActiveMemberRole()
const isAdmin = computed(() => {
  const role = activeMemberRole.value.data?.role
  return role === 'admin' || role === 'owner'
})
const roleLabel = computed(() => {
  const role = activeMemberRole.value.data?.role
  if (role === 'owner') return t('team.roleOwner')
  if (role === 'admin') return t('team.roleAdmin')
  return t('team.roleMember')
})

type NavItem = {
  routeName: string
  to: string
  label: string
  adminOnly: boolean
}

const navItems = computed<NavItem[]>(() => [
  { routeName: 'dashboard', to: '/dashboard', label: t('nav.home'), adminOnly: false },
  { routeName: 'tasks', to: '/tasks', label: t('nav.myTasks'), adminOnly: false },
  { routeName: 'runs', to: '/runs', label: t('nav.runs'), adminOnly: true },
  { routeName: 'workflows', to: '/workflows', label: t('nav.templates'), adminOnly: true },
  { routeName: 'team', to: '/team', label: t('team.title'), adminOnly: true },
  { routeName: 'settings', to: '/settings', label: t('nav.settings'), adminOnly: true },
  { routeName: 'billing', to: '/billing', label: t('billing.title'), adminOnly: true },
])

function isActive(routeName: string) {
  if (routeName === 'runs') return route.name === 'runs' || route.name === 'run-detail'
  if (routeName === 'workflows')
    return route.name === 'workflows' || route.name === 'workflow-editor'
  return route.name === routeName
}

const { data: trialStatus } = useTrialStatus()
const trialProgressPct = computed(() => {
  if (!trialStatus.value) return 0
  return Math.round(
    ((TRIAL_LENGTH_DAYS - trialStatus.value.daysRemaining) / TRIAL_LENGTH_DAYS) * 100,
  )
})

async function logout() {
  await authClient.signOut()
  await router.push('/sign-in')
}

const activeOrganization = authClient.useActiveOrganization()
const changingLocale = ref(false)
const localeError = ref('')

async function changeLocale(locale: Locale) {
  if (locale === activeOrganization.value.data?.locale || changingLocale.value) return
  localeError.value = ''
  changingLocale.value = true
  try {
    const { error } = await authClient.organization.update({ data: { locale } })
    if (error) localeError.value = t('shell.languageError')
  } catch {
    localeError.value = t('shell.languageError')
  } finally {
    changingLocale.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-app-bg font-app-sans text-[15px] leading-normal text-app-ink">
    <!-- Left sidebar -->
    <div class="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col bg-app-ink px-4 py-6">
      <div class="px-2 pb-7">
        <AppLogo dark size="sm" />
      </div>

      <nav class="flex flex-col gap-1.5">
        <template v-for="item in navItems" :key="item.routeName">
          <RouterLink
            v-if="!item.adminOnly || isAdmin"
            :to="item.to"
            class="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-bold"
            :class="isActive(item.routeName) ? 'bg-app-surface text-app-ink' : 'text-white/80'"
          >
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>

      <div class="flex-1"></div>

      <div v-if="trialStatus" class="rounded-2xl bg-white/10 px-4 pb-4.5 pt-4">
        <div class="mb-2.5 text-[13.5px] font-bold text-white">
          {{
            trialStatus.isReadOnly
              ? t('trialBanner.expired')
              : t('trialBanner.daysLeft', trialStatus.daysRemaining)
          }}
        </div>
        <div
          v-if="!trialStatus.isReadOnly"
          class="mb-3.5 h-1.5 overflow-hidden rounded-full bg-white/15"
        >
          <div
            class="h-full rounded-full bg-app-surface"
            :style="{ width: `${trialProgressPct}%` }"
          />
        </div>
        <RouterLink
          to="/billing"
          class="block rounded-lg bg-app-surface px-2.5 py-2.5 text-center text-[13.5px] font-extrabold text-app-ink"
        >
          {{ t('shell.upgradePlan') }}
        </RouterLink>
      </div>
    </div>

    <!-- Center column -->
    <div class="flex min-w-0 flex-1 flex-col">
      <div
        class="sticky top-0 z-50 flex h-[72px] shrink-0 items-center gap-4.5 border-b border-app-border bg-white px-8"
      >
        <OrgSwitcher />
        <div class="flex-1"></div>
        <div
          class="flex shrink-0 items-center gap-0.5 rounded-full bg-app-bg p-1"
          :title="t('shell.languageError')"
        >
          <button
            v-for="loc in SUPPORTED_LOCALES"
            :key="loc"
            type="button"
            :disabled="changingLocale"
            class="rounded-full px-3 py-1.5 text-[12.5px] font-extrabold"
            :class="
              activeOrganization.data?.locale === loc ? 'bg-white text-app-ink' : 'text-app-muted'
            "
            @click="changeLocale(loc)"
          >
            {{ t(`locale.${loc}`) }}
          </button>
        </div>
        <div class="flex w-[180px] shrink items-center gap-2 rounded-full bg-app-bg px-4.5 py-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B9E98"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span class="text-sm text-app-muted">{{ t('shell.search') }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2.5 rounded-full bg-app-bg py-1.5 ps-1.5 pe-3.5">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-accent text-[12.5px] font-bold text-white"
          >
            {{ initialsFor(session.data?.user.name ?? '') }}
          </div>
          <div class="min-w-0">
            <div class="whitespace-nowrap text-[13.5px] font-bold leading-tight">
              {{ session.data?.user.name }}
            </div>
            <div class="whitespace-nowrap text-[11.5px] leading-tight text-app-muted">
              {{ roleLabel }}
            </div>
          </div>
        </div>
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-bg"
          :title="t('dashboard.logOut')"
          @click="logout"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2D5450"
            stroke-width="1.9"
            stroke-linecap="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>

      <div class="flex flex-1 items-start">
        <div class="min-w-0 flex-1 px-8 py-8 pb-18">
          <RouterView />
        </div>

        <div v-if="isAdmin" class="hidden w-[300px] shrink-0 py-8 pe-7 pb-18 xl:block">
          <TodayAtAGlance />
          <ActivityFeed class="mt-4.5" />
        </div>
      </div>
    </div>
  </div>
</template>
