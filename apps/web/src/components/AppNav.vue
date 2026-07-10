<script setup lang="ts">
import AppLogo from './AppLogo.vue'
</script>

<template>
  <nav
    class="sticky top-0 z-[100] border-b border-black/[0.06] backdrop-blur-[14px]"
    style="background: rgba(255, 255, 255, 0.92)"
  >
    <div class="max-w-[1160px] mx-auto px-10 h-16 flex items-center justify-between">
      <AppLogo />
      <div class="flex items-center gap-8">
        <a href="#how" class="text-[13.5px] font-medium text-gray-500">How it works</a>
        <a href="#features" class="text-[13.5px] font-medium text-gray-500">Features</a>
        <a href="#pricing" class="text-[13.5px] font-medium text-gray-500">Pricing</a>
        <RouterLink
          to="/sign-up"
          class="text-[13.5px] font-semibold text-white bg-brand-teal px-5 py-[9px] rounded-lg"
        >
          Start free trial
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
