<script setup lang="ts">
// Placeholder for issue #45 ("Subscribe to a plan"), which builds real
// Stripe checkout here. This view's job for now is just to give the trial
// banner's and reminder email's "Subscribe" CTA somewhere concrete to link.
import OrgSwitcher from '../components/OrgSwitcher.vue'
</script>

<template>
  <div class="min-h-screen bg-brand-surface px-4 py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-brand-dark">Billing</h1>
        <div class="flex items-center gap-4">
          <OrgSwitcher />
          <RouterLink to="/dashboard" class="text-sm text-brand-teal font-medium hover:underline"
            >← Back to dashboard</RouterLink
          >
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8 text-center">
        <h2 class="text-lg font-semibold text-brand-dark mb-2">Plan selection is coming soon</h2>
        <p class="text-sm text-gray-500">
          We're finishing up subscription plans. Check back shortly to add a payment method and pick
          a plan.
        </p>
      </div>
    </div>
  </div>
</template>
