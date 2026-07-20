<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { authClient } from '../lib/auth-client'
import OrgSwitcher from '../components/OrgSwitcher.vue'
import TrialBanner from '../components/TrialBanner.vue'

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
          <h1 class="text-2xl font-bold text-brand-dark">Dashboard</h1>
          <div class="flex items-center gap-4">
            <OrgSwitcher />
            <button
              type="button"
              class="text-sm font-medium text-brand-teal hover:underline"
              @click="logout"
            >
              Log out
            </button>
          </div>
        </div>
        <p class="text-sm text-gray-500">
          Signed in as
          <span class="font-medium text-brand-dark">{{ session.data?.user.email }}</span>
        </p>
        <div v-if="isAdmin" class="mt-6 flex flex-col gap-2 items-start">
          <RouterLink to="/team" class="text-sm text-brand-teal font-medium hover:underline">
            Invite a team member →
          </RouterLink>
          <RouterLink to="/workflows" class="text-sm text-brand-teal font-medium hover:underline">
            Manage checklist templates →
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
