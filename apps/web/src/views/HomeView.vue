<script setup lang="ts">
import AppFooter from '../components/AppFooter.vue'
import AppNav from '../components/AppNav.vue'
import CtaBand from '../components/sections/CtaBand.vue'
import FeaturesSection from '../components/sections/FeaturesSection.vue'
import HeroSection from '../components/sections/HeroSection.vue'
import HowItWorksSection from '../components/sections/HowItWorksSection.vue'
import IntegrationsSection from '../components/sections/IntegrationsSection.vue'
import PricingSection from '../components/sections/PricingSection.vue'
import StatsBar from '../components/sections/StatsBar.vue'
import TestimonialsSection from '../components/sections/TestimonialsSection.vue'
</script>

<template>
  <AppNav />
  <main>
    <HeroSection />
    <StatsBar />
    <HowItWorksSection />
    <FeaturesSection />
    <IntegrationsSection />
    <TestimonialsSection />
    <PricingSection />
    <CtaBand />
  </main>
  <AppFooter />
</template>
