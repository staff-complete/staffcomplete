<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { earlyAccessRequestSchema } from '@staffcomplete/shared'

type FormState = 'idle' | 'submitting' | 'done'

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

const email = ref('')
const company = ref('')
// Honeypot. Hidden from people and skipped by the keyboard, so anything that
// fills it is a bot — the endpoint drops those submissions silently.
const website = ref('')
const state = ref<FormState>('idle')
const error = ref('')
const turnstileToken = ref('')
const turnstileHost = useTemplateRef<HTMLDivElement>('turnstileHost')

onMounted(() => {
  if (!siteKey) return

  const script = document.createElement('script')
  script.src = TURNSTILE_SCRIPT_URL
  script.async = true
  script.onload = () => {
    if (!turnstileHost.value) return
    window.turnstile?.render(turnstileHost.value, {
      sitekey: siteKey,
      theme: 'dark',
      callback: (token) => {
        turnstileToken.value = token
      },
      'expired-callback': () => {
        turnstileToken.value = ''
      },
    })
  }
  document.head.append(script)
})

async function submit() {
  const parsed = earlyAccessRequestSchema.safeParse({
    email: email.value,
    company: company.value === '' ? undefined : company.value,
  })

  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Please check the form'
    return
  }

  state.value = 'submitting'
  error.value = ''

  try {
    const response = await fetch('/api/early-access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...parsed.data,
        website: website.value,
        turnstileToken: turnstileToken.value,
      }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      error.value = body.error ?? 'Something went wrong. Please try again.'
      state.value = 'idle'
      return
    }

    state.value = 'done'
  } catch {
    error.value = 'Could not reach us. Please check your connection and try again.'
    state.value = 'idle'
  }
}
</script>

<template>
  <section
    id="early-access"
    class="py-[100px] px-10 text-center relative overflow-hidden scroll-mt-16"
    style="background: linear-gradient(135deg, #041f1c 0%, #082e28 100%)"
  >
    <div
      class="absolute inset-0 pointer-events-none"
      style="
        background-image: radial-gradient(rgba(45, 212, 191, 0.06) 1px, transparent 1px);
        background-size: 40px 40px;
      "
    ></div>

    <div class="relative z-[1] max-w-[560px] mx-auto flex flex-col items-center gap-6">
      <div
        class="inline-flex items-center gap-2 rounded-full py-[5px] pr-3.5 pl-2 w-fit"
        style="background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.25)"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-brand-light block flex-shrink-0"></span>
        <span class="text-[11.5px] font-semibold text-brand-light tracking-[0.04em]">
          Early access
        </span>
      </div>

      <h2 class="m-0 text-[44px] font-extrabold tracking-[-0.04em] text-white leading-[1.08]">
        We are building this with our first teams
      </h2>

      <p class="m-0 text-base leading-[1.7] max-w-[420px]" style="color: rgba(255, 255, 255, 0.45)">
        StaffComplete is not open to everyone yet. Leave your email and we will get in touch as we
        onboard the first companies — and we will ask what you actually need before we build it.
      </p>

      <p
        v-if="state === 'done'"
        class="m-0 text-[15px] leading-[1.7] text-brand-light font-semibold max-w-[420px]"
        role="status"
      >
        Thanks — you are on the list. We will email you from staffcomplete.io, so keep an eye on
        your spam folder just in case.
      </p>

      <form v-else class="w-full flex flex-col gap-3 mt-2" novalidate @submit.prevent="submit">
        <div class="flex flex-col sm:flex-row gap-3">
          <label class="sr-only" for="early-access-email">Work email</label>
          <input
            id="early-access-email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            placeholder="you@company.com"
            class="flex-1 text-[15px] text-white placeholder:text-white/30 rounded-[10px] px-4 py-[13px] outline-none focus:border-brand-light"
            style="
              background: rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(255, 255, 255, 0.12);
            "
          />
          <label class="sr-only" for="early-access-company">Company</label>
          <input
            id="early-access-company"
            v-model="company"
            type="text"
            name="company"
            autocomplete="organization"
            placeholder="Company (optional)"
            class="flex-1 text-[15px] text-white placeholder:text-white/30 rounded-[10px] px-4 py-[13px] outline-none focus:border-brand-light"
            style="
              background: rgba(255, 255, 255, 0.06);
              border: 1px solid rgba(255, 255, 255, 0.12);
            "
          />
        </div>

        <!-- Honeypot: off-screen rather than display:none so bots still fill it. -->
        <div class="absolute -left-[9999px]" aria-hidden="true">
          <label for="early-access-website">Leave this field empty</label>
          <input
            id="early-access-website"
            v-model="website"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
          />
        </div>

        <div v-if="siteKey" ref="turnstileHost" class="flex justify-center"></div>

        <button
          type="submit"
          :disabled="state === 'submitting'"
          class="text-[15px] font-bold text-brand-dark bg-brand-light py-[15px] px-9 rounded-[10px] tracking-[-0.01em] disabled:opacity-60"
        >
          {{ state === 'submitting' ? 'Sending…' : 'Request early access →' }}
        </button>

        <p v-if="error" class="m-0 text-[13.5px] text-red-300" role="alert">{{ error }}</p>

        <p class="m-0 text-[12.5px]" style="color: rgba(255, 255, 255, 0.3)">
          One email when we are ready for you. No newsletter, no sharing your address.
        </p>
      </form>
    </div>
  </section>
</template>
