<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authClient } from '../lib/auth-client'
import ActivityFeed from '../components/ActivityFeed.vue'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

const { t } = useI18n()
const router = useRouter()
const session = authClient.useSession()
const activeMemberRole = authClient.useActiveMemberRole()
const isAdmin = computed(() => {
  const role = activeMemberRole.value.data?.role
  return role === 'admin' || role === 'owner'
})

async function logout() {
  await authClient.signOut()
  await router.push('/sign-in')
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-4">
      <TrialBanner />
      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-brand-dark">{{ t('dashboard.title') }}</h1>
          <div class="flex items-center gap-4">
            <OrgSwitcher />
            <button
              type="button"
              class="text-sm font-medium text-brand-teal hover:underline"
              @click="logout"
            >
              {{ t('dashboard.logOut') }}
            </button>
          </div>
        </div>
        <p class="text-sm text-gray-500">
          {{ t('dashboard.signedInAs') }}
          <span class="font-medium text-brand-dark">{{ session.data?.user.email }}</span>
        </p>
        <div class="mt-6 flex flex-col gap-2 items-start">
          <RouterLink to="/tasks" class="text-sm text-brand-teal font-medium hover:underline">
            {{ t('dashboard.myTasks') }}
          </RouterLink>
          <template v-if="isAdmin">
            <RouterLink to="/team" class="text-sm text-brand-teal font-medium hover:underline">
              {{ t('dashboard.inviteTeamMember') }}
            </RouterLink>
            <RouterLink to="/workflows" class="text-sm text-brand-teal font-medium hover:underline">
              {{ t('dashboard.manageTemplates') }}
            </RouterLink>
            <RouterLink
              to="/runs/onboarding"
              class="text-sm text-brand-teal font-medium hover:underline"
            >
              {{ t('dashboard.startOnboarding') }}
            </RouterLink>
            <RouterLink
              to="/runs/offboarding"
              class="text-sm text-brand-teal font-medium hover:underline"
            >
              {{ t('dashboard.startOffboarding') }}
            </RouterLink>
          </template>
        </div>
      </div>

      <ActivityFeed v-if="isAdmin" />
    </div>
  </div>
</template>
