<script setup lang="ts">
import SectionHeader from '../SectionHeader.vue'

const testimonials = [
  {
    quote:
      "We used to spend two full days onboarding each new hire across all our tools. With StaffComplete it takes about four minutes — and we haven't had a single missed access provisioning since.",
    name: 'Amina Khoury',
    role: 'Head of People, Parcel (120 employees)',
    initials: 'AK',
    avatarBg: '#0d9488',
  },
  {
    quote:
      'The offboarding piece is what sold us. An employee resigned on a Friday evening and every single account was revoked automatically before 9 AM Monday. Our security team was impressed.',
    name: 'Marcus Svensson',
    role: 'IT Director, Nordly (350 employees)',
    initials: 'MS',
    avatarBg: '#0f766e',
  },
  {
    quote:
      'We scaled from 40 to 200 employees in 18 months. Without StaffComplete, our HR team would have needed to double in size just to keep up with provisioning.',
    name: 'Julia Lenz',
    role: 'VP People, Mosswood (200 employees)',
    initials: 'JL',
    avatarBg: '#134e4a',
  },
]
</script>

<template>
  <section class="py-[100px] px-10 bg-brand-surface">
    <div class="max-w-[1160px] mx-auto">
      <SectionHeader eyebrow="Customer stories" heading="HR teams that got their time back" />

      <div class="grid grid-cols-3 gap-5">
        <div
          v-for="t in testimonials"
          :key="t.name"
          class="bg-white rounded-[20px] p-9 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col gap-5"
        >
          <div class="text-brand-teal text-base" aria-label="5 stars">★★★★★</div>
          <p class="m-0 text-[14.5px] leading-[1.75] text-gray-700 italic">"{{ t.quote }}"</p>
          <div class="flex items-center gap-3 mt-auto pt-4 border-t border-[#f2f2f2]">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
              :style="{ background: t.avatarBg }"
              aria-hidden="true"
            >
              {{ t.initials }}
            </div>
            <div>
              <div class="text-[13px] font-bold text-[#1c1c1e]">{{ t.name }}</div>
              <div class="text-[11.5px] text-gray-400">{{ t.role }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
