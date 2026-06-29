<script setup lang="ts">
defineProps<{
  eyebrow: string
  heading: string
  subtext?: string
  subtextMaxWidth?: string
  headingClass?: string
}>()
</script>

<template>
  <div class="text-center mb-16">
    <div class="text-[10px] font-bold tracking-[0.24em] uppercase text-brand-teal mb-3.5">
      {{ eyebrow }}
    </div>
    <h2
      class="m-0 mb-4 text-[40px] font-extrabold tracking-[-0.04em] text-[#1c1c1e]"
      :class="headingClass"
    >
      {{ heading }}
    </h2>
    <p
      v-if="subtext"
      class="m-0 mx-auto text-base text-gray-500 leading-[1.7]"
      :style="subtextMaxWidth ? { maxWidth: subtextMaxWidth } : { maxWidth: '440px' }"
    >
      {{ subtext }}
    </p>
  </div>
</template>
