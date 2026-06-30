<script setup lang="ts">
import SectionHeader from '../SectionHeader.vue'

interface PricingTier {
  name: string
  tagline: string
  price: string
  priceNote: string
  billingNote: string
  cta: string
  ctaStyle: 'outline' | 'solid' | 'accent'
  features: string[]
  featured?: boolean
  dark?: boolean
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    tagline: 'Up to 50 employees',
    price: '$149',
    priceNote: '/mo',
    billingNote: 'Save 2 months billed annually',
    cta: 'Start free trial',
    ctaStyle: 'outline',
    features: [
      'Google Workspace + Slack integrations',
      'Onboarding & offboarding workflows',
      'Manual task fallback with due dates',
      '1 HRIS trigger (BambooHR or HiBob)',
      'Audit log (90 days)',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    tagline: 'Up to 150 employees',
    price: '$349',
    priceNote: '/mo',
    billingNote: 'Save 2 months billed annually',
    cta: 'Start free trial',
    ctaStyle: 'solid',
    featured: true,
    features: [
      'Everything in Starter',
      'All integrations (GitHub, Jira, Notion and more)',
      'All HRIS triggers',
      'Role & team change workflows',
      'Full audit log + CSV export',
      'Priority support',
    ],
  },
  {
    name: 'Custom',
    tagline: 'For larger or faster-growing teams',
    price: 'Custom',
    priceNote: '',
    billingNote: 'Volume discounts available',
    cta: 'Talk to us',
    ctaStyle: 'accent',
    dark: true,
    features: [
      'Everything in Growth',
      'Additional integrations on request',
      'Dedicated onboarding support',
      'Priority SLA',
      'Invoicing available',
    ],
  },
]
</script>

<template>
  <section id="pricing" class="py-[100px] px-10 bg-white">
    <div class="max-w-[1160px] mx-auto">
      <SectionHeader
        eyebrow="Pricing"
        heading="Simple, predictable pricing"
        subtext="One flat fee. No per-hire charges. No surprises."
        subtextMaxWidth="380px"
      />

      <div class="grid grid-cols-3 gap-5 items-start">
        <div
          v-for="tier in tiers"
          :key="tier.name"
          class="rounded-[20px] p-10 relative"
          :class="[
            tier.dark
              ? 'bg-brand-dark'
              : tier.featured
                ? 'border-2 border-brand-teal shadow-[0_4px_32px_rgba(13,148,136,0.12)]'
                : 'border border-gray-200',
          ]"
        >
          <!-- popular badge -->
          <div
            v-if="tier.featured"
            class="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-teal text-white text-[10.5px] font-bold tracking-[0.12em] px-4 py-[5px] rounded-full whitespace-nowrap"
          >
            MOST POPULAR
          </div>

          <div
            class="text-[13px] font-bold mb-1.5 tracking-[0.02em]"
            :class="tier.dark ? 'text-white' : 'text-[#1c1c1e]'"
          >
            {{ tier.name }}
          </div>
          <div class="text-[11.5px] mb-7" :class="tier.dark ? 'text-white/35' : 'text-gray-400'">
            {{ tier.tagline }}
          </div>

          <div class="flex items-baseline gap-1 mb-1.5">
            <span
              class="text-[42px] font-extrabold tracking-[-0.05em]"
              :class="
                tier.dark ? 'text-white' : tier.featured ? 'text-brand-teal' : 'text-[#1c1c1e]'
              "
            >
              {{ tier.price }}
            </span>
            <span v-if="tier.priceNote" class="text-sm font-medium text-gray-400">
              {{ tier.priceNote }}
            </span>
          </div>
          <div class="text-xs mb-8" :class="tier.dark ? 'text-white/30' : 'text-gray-400'">
            {{ tier.billingNote }}
          </div>

          <a
            href="#"
            class="block text-center text-sm font-bold px-0 py-[13px] rounded-[10px] mb-8"
            :class="{
              'text-brand-teal bg-brand-surface': tier.ctaStyle === 'outline',
              'text-white bg-brand-teal': tier.ctaStyle === 'solid',
              'text-brand-dark bg-brand-light': tier.ctaStyle === 'accent',
            }"
          >
            {{ tier.cta }}
          </a>

          <div class="flex flex-col gap-3">
            <div
              v-for="feature in tier.features"
              :key="feature"
              class="flex items-center gap-2.5 text-[13px]"
              :class="tier.dark ? 'text-white/65' : 'text-gray-700'"
            >
              <span
                class="font-bold text-[15px] flex-shrink-0"
                :class="tier.dark ? 'text-brand-light' : 'text-brand-teal'"
              >
                ✓
              </span>
              {{ feature }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
