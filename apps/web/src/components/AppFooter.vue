<script setup lang="ts">
import AppLogo from './AppLogo.vue'

// Set at build time by the Pages build (VITE_APP_VERSION) — unset in local dev.
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'

// Only links that go somewhere real. The product pages, blog and legal pages
// the full footer used to promise do not exist yet.
const links = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Early access', href: '#early-access' },
]
</script>

<template>
  <footer class="bg-brand-dark pt-16 pb-10 px-10 border-t border-white/[0.05]">
    <div class="max-w-[1160px] mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-10 mb-[52px]">
        <div>
          <div class="mb-4">
            <AppLogo dark size="sm" />
          </div>
          <p class="m-0 text-[13px] leading-[1.75] text-white/30 max-w-[240px]">
            Automate the full employee lifecycle across all your company systems.
          </p>
        </div>
        <div class="flex flex-col gap-3">
          <div class="text-[10.5px] font-bold tracking-[0.18em] uppercase text-white/30 mb-2">
            StaffComplete
          </div>
          <a
            v-for="link in links"
            :key="link.href"
            :href="link.href"
            class="text-[13px] text-white/50 font-medium"
          >
            {{ link.label }}
          </a>
        </div>
      </div>
      <div class="pt-7 border-t border-white/[0.07] flex items-center justify-between">
        <div class="text-xs text-white/20">
          © 2026 StaffComplete. All rights reserved.
          <span class="ml-2">{{ appVersion }}</span>
        </div>
        <div class="text-xs text-white/20">Made for HR teams who have better things to do.</div>
      </div>
    </div>
  </footer>
</template>
