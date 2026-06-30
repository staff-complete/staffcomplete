<script setup lang="ts">
import SectionHeader from '../SectionHeader.vue'

interface Feature {
  emoji: string
  title: string
  description: string
  dark?: boolean
  link?: string
}

const features: Feature[] = [
  {
    emoji: '🚀',
    title: 'Instant onboarding',
    description:
      'HR triggers onboarding in one click. Every account, access, and tool gets set up automatically before day one.',
  },
  {
    emoji: '💬',
    title: 'Alerts that actually land',
    description:
      'Task owners get notified wherever they read messages — Slack, email, or WhatsApp. Overdue reminders go out automatically.',
  },
  {
    emoji: '🔒',
    title: 'Secure offboarding',
    description:
      'When someone leaves, all access is revoked simultaneously — no overlooked accounts, no security gaps.',
  },
  {
    emoji: '📋',
    title: 'Full audit trail',
    description:
      'Every provisioning and offboarding action is logged with who did it and when. Know exactly what happened — no chasing.',
  },
  {
    emoji: '⚡',
    title: 'Nothing falls through',
    description:
      'For tools without an API, StaffComplete creates a task for the right person with a due date and an overdue alert. Manual steps are tracked too.',
  },
  {
    emoji: '🧩',
    title: 'Works with your stack',
    description:
      'Google Workspace, Slack, BambooHR, HiBob, Jira, Notion and more — connected in minutes, not weeks.',
    dark: true,
    link: '#integrations',
  },
]
</script>

<template>
  <section id="features" class="py-[100px] px-10 bg-brand-surface">
    <div class="max-w-[1160px] mx-auto">
      <SectionHeader
        eyebrow="Features"
        heading="Everything HR teams need"
        subtext="Purpose-built for People operations — not bolted onto an HRIS as an afterthought."
      />

      <div class="grid grid-cols-3 gap-5">
        <div
          v-for="feature in features"
          :key="feature.title"
          class="rounded-[18px] p-[34px_32px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          :class="feature.dark ? 'bg-brand-dark' : 'bg-white'"
        >
          <div class="text-2xl mb-4" aria-hidden="true">{{ feature.emoji }}</div>
          <h3
            class="m-0 mb-2 text-[17px] font-bold tracking-[-0.02em]"
            :class="feature.dark ? 'text-white' : 'text-[#1c1c1e]'"
          >
            {{ feature.title }}
          </h3>
          <p
            class="m-0 text-[13.5px] leading-[1.75]"
            :class="feature.dark ? 'text-white/50' : 'text-gray-500'"
          >
            {{ feature.description }}
          </p>
          <a
            v-if="feature.link"
            :href="feature.link"
            class="inline-block mt-[18px] text-xs font-semibold text-brand-light tracking-[0.03em]"
          >
            See all integrations →
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
