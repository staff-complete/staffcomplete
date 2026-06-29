<script setup lang="ts">
import AppLogo from './AppLogo.vue'

const columns = [
  {
    label: 'Product',
    links: ['Features', 'Integrations', 'Pricing', 'Changelog'],
  },
  {
    label: 'Company',
    links: ['About', 'Blog', 'Careers', 'Security'],
  },
  {
    label: 'Legal',
    links: ['Privacy', 'Terms', 'Cookie policy', 'SOC 2'],
  },
]
</script>

<template>
  <footer class="bg-brand-dark pt-16 pb-10 px-10 border-t border-white/[0.05]">
    <div class="max-w-[1160px] mx-auto">
      <div class="grid grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-[52px]">
        <div>
          <div class="mb-4">
            <AppLogo dark size="sm" />
          </div>
          <p class="m-0 text-[13px] leading-[1.75] text-white/30 max-w-[240px]">
            Automate the full employee lifecycle across all your company systems.
          </p>
        </div>
        <div v-for="col in columns" :key="col.label">
          <div class="text-[10.5px] font-bold tracking-[0.18em] uppercase text-white/30 mb-5">
            {{ col.label }}
          </div>
          <div class="flex flex-col gap-3">
            <a
              v-for="link in col.links"
              :key="link"
              href="#"
              class="text-[13px] text-white/50 font-medium"
            >
              {{ link }}
            </a>
          </div>
        </div>
      </div>
      <div class="pt-7 border-t border-white/[0.07] flex items-center justify-between">
        <div class="text-xs text-white/20">© 2026 StaffComplete. All rights reserved.</div>
        <div class="text-xs text-white/20">Made for HR teams who have better things to do.</div>
      </div>
    </div>
  </footer>
</template>
