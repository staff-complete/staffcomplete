<script setup lang="ts">
withDefaults(defineProps<{ dark?: boolean; size?: 'sm' | 'md' }>(), {
  dark: false,
  size: 'md',
})
</script>

<template>
  <div class="flex items-center gap-3">
    <svg
      :width="size === 'sm' ? 46 : 52"
      :height="size === 'sm' ? 26 : 30"
      viewBox="0 0 140 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M 18,62 C 44,62 44,40 70,40 C 96,40 96,18 122,18"
        fill="none"
        :stroke="dark ? 'white' : '#0D9488'"
        stroke-width="5"
        stroke-linecap="round"
      />
      <circle
        cx="18"
        cy="62"
        r="11"
        :fill="dark ? '#041F1C' : 'white'"
        :stroke="dark ? 'white' : '#0D9488'"
        stroke-width="5"
      />
      <circle cx="70" cy="40" r="13.5" :fill="dark ? 'white' : '#0D9488'" />
      <circle cx="70" cy="40" r="5.5" :fill="dark ? '#041F1C' : 'white'" />
      <circle
        cx="122"
        cy="18"
        r="11"
        :fill="dark ? '#041F1C' : 'white'"
        :stroke="dark ? 'white' : '#0D9488'"
        stroke-width="5"
      />
    </svg>
    <span
      class="font-bold tracking-[-0.03em] leading-none"
      :class="size === 'sm' ? 'text-[17px]' : 'text-[19px]'"
      aria-label="StaffComplete"
    >
      <span :class="dark ? 'text-white/70 font-light' : 'text-[#1c1c1e] font-light'">Staff</span>
      <span :class="dark ? 'text-brand-light' : 'text-brand-teal'">Complete</span>
    </span>
  </div>
</template>
