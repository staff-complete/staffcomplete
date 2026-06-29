<script setup lang="ts">
import StepIcon from '../icons/StepIcon.vue'
import SectionHeader from '../SectionHeader.vue'

const steps: Array<{
  number: string
  title: string
  description: string
  icon: 'connect' | 'configure' | 'automate'
}> = [
  {
    number: '01',
    title: 'Connect your stack',
    description:
      'Connect Google Workspace, Slack, and BambooHR in two clicks each. No code, no IT ticket, no waiting.',
    icon: 'connect',
  },
  {
    number: '02',
    title: 'Define your workflows',
    description:
      'Pick a pre-built template for new hires or leavers, or build your own checklist in minutes. No engineer involved.',
    icon: 'configure',
  },
  {
    number: '03',
    title: 'Automate & relax',
    description:
      'Every system update, provisioning step, and offboarding action runs automatically — with a full audit trail.',
    icon: 'automate',
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
            <StepIcon :name="step.icon" />
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
