<script setup lang="ts">
import SectionHeader from '../SectionHeader.vue'

const steps = [
  {
    number: '01',
    title: 'Connect your stack',
    description:
      'Link Google Workspace, Slack, GitHub, Okta, Jira and 40+ more in minutes. No custom code required.',
    icon: `<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>`,
  },
  {
    number: '02',
    title: 'Define your workflows',
    description:
      'Set rules for each lifecycle event — new hire, role change, leave, offboarding. Use templates or build your own.',
    icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  },
  {
    number: '03',
    title: 'Automate & relax',
    description:
      'Every system update, provisioning step, and offboarding action runs automatically — with a full audit trail.',
    icon: `<polyline points="20 6 9 17 4 12"/>`,
  },
]
</script>

<template>
  <section id="how" class="py-[100px] px-10 bg-white">
    <div class="max-w-[1160px] mx-auto">
      <SectionHeader
        eyebrow="How it works"
        heading="Three steps. Zero gaps."
        subtext="Connect your systems once, then let StaffComplete handle every lifecycle event automatically."
      />

      <div class="grid grid-cols-3 gap-7 relative">
        <!-- connector line -->
        <div
          class="absolute top-[52px] opacity-25 h-0.5 z-0"
          style="
            left: calc(16.7% + 28px);
            right: calc(16.7% + 28px);
            background: linear-gradient(90deg, #0d9488, #2dd4bf, #0d9488);
          "
          aria-hidden="true"
        ></div>

        <div
          v-for="step in steps"
          :key="step.number"
          class="bg-[#f8fffe] border border-brand-border rounded-[20px] p-10 relative z-[1]"
        >
          <div class="w-11 h-11 bg-brand-teal rounded-xl flex items-center justify-center mb-6">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="step.icon"
            ></svg>
          </div>
          <div class="text-[11px] font-bold text-brand-teal tracking-[0.16em] uppercase mb-2.5">
            Step {{ step.number }}
          </div>
          <h3 class="m-0 mb-2.5 text-xl font-bold tracking-[-0.02em] text-[#1c1c1e]">
            {{ step.title }}
          </h3>
          <p class="m-0 text-sm leading-[1.75] text-gray-500">{{ step.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
