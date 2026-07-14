<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { authClient } from '../lib/auth-client'

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
    <div class="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-brand-border p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-brand-dark">Dashboard</h1>
        <button
          type="button"
          class="text-sm font-medium text-brand-teal hover:underline"
          @click="logout"
        >
          Log out
        </button>
      </div>
      <p class="text-sm text-gray-500">
        Signed in as
        <span class="font-medium text-brand-dark">{{ session.data?.user.email }}</span>
      </p>
      <RouterLink
        v-if="isAdmin"
        to="/team"
        class="inline-block mt-6 text-sm text-brand-teal font-medium hover:underline"
      >
        Invite a team member →
      </RouterLink>
    </div>
  </div>
</template>
