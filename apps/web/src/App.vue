<script setup lang="ts">
import AppFooter from './components/AppFooter.vue'
import AppNav from './components/AppNav.vue'
import EarlyAccessForm from './components/EarlyAccessForm.vue'
import FeaturesSection from './components/sections/FeaturesSection.vue'
import HeroSection from './components/sections/HeroSection.vue'
import HowItWorksSection from './components/sections/HowItWorksSection.vue'
import IntegrationsSection from './components/sections/IntegrationsSection.vue'
</script>

<template>
  <AppNav />
  <main>
    <HeroSection />
    <HowItWorksSection />
    <FeaturesSection />
    <IntegrationsSection />
    <EarlyAccessForm />
  </main>
  <AppFooter />
</template>
