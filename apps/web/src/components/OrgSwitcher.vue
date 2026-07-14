<script setup lang="ts">
import { computed } from 'vue'
import { authClient } from '../lib/auth-client'

const organizations = authClient.useListOrganizations()
const activeOrganization = authClient.useActiveOrganization()

// Only worth showing once there's something to switch between — most users
// belong to exactly one organization.
const hasMultipleOrgs = computed(() => (organizations.value.data?.length ?? 0) > 1)

async function switchOrg(event: Event) {
  const organizationId = (event.target as HTMLSelectElement).value
  if (!organizationId || organizationId === activeOrganization.value.data?.id) return

  await authClient.organization.setActive({ organizationId })
  // Simplest way to get every view's plain (non-reactive) fetches — team
  // list, invites, etc. — to reload scoped to the newly active organization.
  window.location.reload()
}
</script>

<template>
  <select
    v-if="hasMultipleOrgs"
    :value="activeOrganization.data?.id"
    class="text-sm border border-brand-border rounded-lg px-2 py-1.5 bg-white text-brand-dark outline-none focus:border-brand-teal"
    @change="switchOrg"
  >
    <option v-for="org in organizations.data ?? []" :key="org.id" :value="org.id">
      {{ org.name }}
    </option>
  </select>
</template>
