<template>
  <section
    class="pt-[100px] px-10 pb-0 relative overflow-hidden"
    style="background: linear-gradient(160deg, #041f1c 0%, #082e28 52%, #0f3d36 100%)"
  >
    <!-- dot grid -->
    <div
      class="absolute inset-0 pointer-events-none"
      style="
        background-image: radial-gradient(rgba(45, 212, 191, 0.07) 1px, transparent 1px);
        background-size: 40px 40px;
      "
    ></div>
    <!-- glow blob -->
    <div
      class="absolute -top-[120px] -right-20 w-[600px] h-[600px] pointer-events-none"
      style="background: radial-gradient(circle, rgba(13, 148, 136, 0.18) 0%, transparent 65%)"
    ></div>

    <div class="max-w-[1160px] mx-auto relative z-[1]">
      <div class="grid grid-cols-2 gap-[60px] items-center">
        <!-- copy -->
        <div class="flex flex-col gap-7 pb-[100px]">
          <!-- badge -->
          <div
            class="inline-flex items-center gap-2 rounded-full py-[5px] pr-3.5 pl-2 w-fit"
            style="background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.25)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-brand-light block flex-shrink-0"></span>
            <span class="text-[11.5px] font-semibold text-brand-light tracking-[0.04em]">
              Built for HR &amp; People teams
            </span>
          </div>

          <h1 class="m-0 text-[56px] font-extrabold leading-[1.06] tracking-[-0.04em] text-white">
            Every employee,<br />
            <span class="text-brand-light">every system,</span><br />
            always in sync.
          </h1>

          <p
            class="m-0 text-[16.5px] leading-[1.75] font-normal max-w-[420px]"
            style="color: rgba(255, 255, 255, 0.5)"
          >
            Automate the full employee lifecycle across all your company tools — from day-one
            onboarding to final offboarding. No manual tickets. No missed steps.
          </p>

          <div class="flex items-center gap-3.5">
            <a
              href="#pricing"
              class="text-sm font-bold text-white bg-brand-teal px-7 py-3.5 rounded-[10px] tracking-[-0.01em]"
            >
              Start free trial
            </a>
            <a
              href="#how"
              class="text-sm font-semibold flex items-center gap-1.5"
              style="color: rgba(255, 255, 255, 0.6)"
            >
              See how it works
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2 7h10M8 3l4 4-4 4"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
          </div>

          <!-- social proof -->
          <div class="flex items-center gap-3">
            <div class="flex" aria-hidden="true">
              <div
                v-for="(avatar, i) in avatars"
                :key="avatar.initials"
                class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-brand-dark"
                :class="[avatar.bg, avatar.text]"
                :style="{
                  marginRight: i < avatars.length - 1 ? '-8px' : '0',
                  zIndex: avatars.length - i,
                }"
              >
                {{ avatar.initials }}
              </div>
            </div>
            <span class="text-xs font-medium" style="color: rgba(255, 255, 255, 0.35)">
              Trusted by 200+ HR teams in early access
            </span>
          </div>
        </div>

        <!-- animated visual -->
        <div class="flex items-center justify-center pb-[60px]">
          <div class="relative w-[340px] h-[340px]">
            <!-- radial glow -->
            <div
              class="absolute rounded-full"
              style="
                inset: -20px;
                background: radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, transparent 70%);
              "
            ></div>

            <!-- SVG + labels -->
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-[18px]">
              <svg
                width="240"
                height="138"
                viewBox="0 0 140 80"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Employee lifecycle: Hire, Manage, Offboard"
              >
                <path
                  d="M 18,62 C 44,62 44,40 70,40 C 96,40 96,18 122,18"
                  fill="none"
                  stroke="#0D9488"
                  stroke-width="4.5"
                  stroke-linecap="round"
                  :style="{
                    strokeDasharray: 122,
                    strokeDashoffset: 122,
                    animation: 'threadDraw 5s ease-in-out infinite',
                  }"
                />
                <circle cx="18" cy="62" r="11" fill="#041F1C" stroke="#0D9488" stroke-width="4.5" />
                <circle
                  cx="70"
                  cy="40"
                  r="13.5"
                  fill="#0D9488"
                  :style="{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    opacity: 0,
                    animation: 'nodeAppear 5s ease-in-out 0.3s infinite',
                  }"
                />
                <circle
                  cx="70"
                  cy="40"
                  r="5.5"
                  fill="#041F1C"
                  :style="{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    opacity: 0,
                    animation: 'nodeAppear 5s ease-in-out 0.3s infinite',
                  }"
                />
                <circle
                  cx="122"
                  cy="18"
                  r="11"
                  fill="#041F1C"
                  stroke="#0D9488"
                  stroke-width="4.5"
                  :style="{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    opacity: 0,
                    animation: 'nodeEnd 5s ease-in-out infinite',
                  }"
                />
              </svg>

              <div class="flex items-center w-[240px] justify-between">
                <div v-for="stage in stages" :key="stage.label" class="text-center w-[52px]">
                  <div
                    class="text-[10px] font-bold tracking-[0.04em]"
                    :class="stage.highlight ? 'text-brand-light' : 'text-white/90'"
                  >
                    {{ stage.label }}
                  </div>
                  <div class="text-[9px] mt-0.5 text-white/30">{{ stage.sub }}</div>
                </div>
              </div>
            </div>

            <!-- floating pills -->
            <div
              v-for="pill in pills"
              :key="pill.name"
              class="absolute flex items-center gap-[7px] rounded-[20px] px-3 py-1.5 backdrop-blur-[8px]"
              :class="pill.position"
              style="
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.1);
              "
            >
              <div
                class="w-[18px] h-[18px] rounded-[4px] flex-shrink-0"
                :style="{ background: pill.color }"
                aria-hidden="true"
              ></div>
              <span class="text-[11px] font-semibold text-white/70">{{ pill.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const avatars = [
  { initials: 'A', bg: 'bg-brand-light', text: 'text-brand-dark' },
  { initials: 'M', bg: 'bg-[#0f766e]', text: 'text-white' },
  { initials: 'K', bg: 'bg-[#134e4a]', text: 'text-white' },
]

const stages = [
  { label: 'Hire', sub: 'Day 1', highlight: false },
  { label: 'Manage', sub: 'Ongoing', highlight: true },
  { label: 'Offboard', sub: 'Final day', highlight: false },
]

const pills = [
  { name: 'Google Workspace', color: '#4285f4', position: 'top-4 left-2' },
  { name: 'Slack', color: '#4a154b', position: 'top-4 right-2' },
  { name: 'GitHub', color: '#24292e', position: 'bottom-4 right-2' },
  { name: 'Okta', color: '#007dc5', position: 'bottom-4 left-2' },
]
</script>
