<script setup lang="ts">
import { computed, ref } from 'vue'
import { authClient } from '../lib/auth-client'
import { initialsFor } from '../lib/avatarColors'

const organizations = authClient.useListOrganizations()
const activeOrganization = authClient.useActiveOrganization()
const menuOpen = ref(false)

// Only worth showing a picker once there's something to switch between —
// most users belong to exactly one organization.
const hasMultipleOrgs = computed(() => (organizations.value.data?.length ?? 0) > 1)

function toggleMenu() {
  if (!hasMultipleOrgs.value) return
  menuOpen.value = !menuOpen.value
}

async function selectOrg(organizationId: string) {
  menuOpen.value = false
  if (organizationId === activeOrganization.value.data?.id) return

  await authClient.organization.setActive({ organizationId })
  // Simplest way to get every view's plain (non-reactive) fetches — team
  // list, invites, etc. — to reload scoped to the newly active organization.
  window.location.reload()
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg py-1.5 ps-1.5 pe-2.5"
      :class="hasMultipleOrgs ? 'cursor-pointer' : 'cursor-default'"
      @click="toggleMenu"
    >
      <img
        v-if="activeOrganization.data?.logo"
        :src="activeOrganization.data.logo"
        alt=""
        class="h-7 w-7 shrink-0 rounded-lg object-cover"
      />
      <div
        v-else
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-ink text-xs font-extrabold text-white"
      >
        {{ initialsFor(activeOrganization.data?.name ?? '') }}
      </div>
      <div class="whitespace-nowrap text-[15px] font-extrabold text-app-ink">
        {{ activeOrganization.data?.name }}
      </div>
      <svg
        v-if="hasMultipleOrgs"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#6B9E98"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="menuOpen && hasMultipleOrgs"
      class="absolute start-0 top-full z-60 mt-1.5 min-w-[220px] rounded-2xl bg-white p-2 shadow-lg"
    >
      <button
        v-for="org in organizations.data ?? []"
        :key="org.id"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start"
        :class="org.id === activeOrganization.data?.id ? 'bg-app-bg' : ''"
        @click="selectOrg(org.id)"
      >
        <img
          v-if="org.logo"
          :src="org.logo"
          alt=""
          class="h-6.5 w-6.5 shrink-0 rounded-md object-cover"
        />
        <div
          v-else
          class="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md bg-app-ink text-[11px] font-extrabold text-white"
        >
          {{ initialsFor(org.name) }}
        </div>
        <div class="min-w-0 flex-1 whitespace-nowrap text-sm font-bold text-app-ink">
          {{ org.name }}
        </div>
        <svg
          v-if="org.id === activeOrganization.data?.id"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0E7C70"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  </div>
</template>
