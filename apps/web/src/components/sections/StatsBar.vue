<script setup lang="ts">
const stats = [
  { value: '98%', label: 'faster onboarding' },
  { value: '0', label: 'missed deprovisioning steps' },
  { value: '40+', label: 'system integrations' },
  { value: '5 min', label: 'average setup time' },
]
</script>

<template>
  <div class="bg-brand-surface border-b border-brand-border-soft">
    <div class="max-w-[1160px] mx-auto px-10 flex items-center justify-around h-[88px]">
      <template v-for="(stat, i) in stats" :key="stat.label">
        <div class="text-center">
          <div class="text-[26px] font-extrabold text-brand-teal tracking-[-0.04em]">
            {{ stat.value }}
          </div>
          <div class="text-[11.5px] text-gray-500 font-medium mt-0.5">{{ stat.label }}</div>
        </div>
        <div
          v-if="i < stats.length - 1"
          class="w-px h-9 bg-brand-border-soft"
          aria-hidden="true"
        ></div>
      </template>
    </div>
  </div>
</template>
