<script setup lang="ts">
import SectionHeader from '../SectionHeader.vue'

const integrations = [
  { name: 'Google Workspace', color: '#4285f4' },
  { name: 'Slack', color: '#4a154b' },
  { name: 'GitHub', color: '#24292e' },
  { name: 'Okta', color: '#007dc5' },
  { name: 'Jira', color: '#0052cc' },
  { name: 'Notion', color: '#000000' },
  { name: 'HubSpot', color: '#f87348' },
  { name: 'BambooHR', color: '#73bf45' },
  { name: 'Microsoft 365', color: '#2eb67d' },
  { name: 'Zendesk', color: '#6762a6' },
]
</script>

<template>
  <section id="integrations" class="py-20 px-10 bg-white border-t border-brand-surface">
    <div class="max-w-[1160px] mx-auto text-center">
      <SectionHeader
        eyebrow="Integrations"
        heading="Works with your entire stack"
        subtext="Connect in one click. No professional services. No waiting."
        subtextMaxWidth="400px"
        heading-class="text-[36px]"
      />

      <div class="flex flex-wrap justify-center gap-3.5">
        <div
          v-for="integration in integrations"
          :key="integration.name"
          class="flex items-center gap-2.5 bg-[#f8fffe] border border-brand-border rounded-xl px-5 py-3"
        >
          <div
            class="w-7 h-7 rounded-[6px] flex-shrink-0"
            :style="{ background: integration.color }"
            aria-hidden="true"
          ></div>
          <span class="text-[13px] font-semibold text-[#1c1c1e]">{{ integration.name }}</span>
        </div>

        <div
          class="flex items-center gap-2.5 bg-brand-surface rounded-xl px-5 py-3"
          style="border: 1.5px dashed #b2d8d4"
        >
          <span class="text-[13px] font-semibold text-brand-teal">+ 30 more</span>
        </div>
      </div>
    </div>
  </section>
</template>
