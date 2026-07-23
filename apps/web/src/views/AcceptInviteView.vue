<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import AppLogo from '../components/AppLogo.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : undefined,
)

type Invite = {
  email: string
  role: string
  organizationName: string | null
  accountExists: boolean
  sessionMatches: boolean
}

const checkingInvite = ref(true)
const invite = ref<Invite | null>(null)

const form = ref({ name: '', password: '', confirmPassword: '' })
const errors = ref<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)
const joining = ref(false)

const schema = computed(() =>
  z
    .object({
      name: z.string().min(2, t('auth.acceptInvite.validationName')),
      password: z
        .string()
        .min(8, t('auth.acceptInvite.validationPasswordMin'))
        .regex(/[A-Z]/, t('auth.acceptInvite.validationPasswordUppercase'))
        .regex(/[0-9]/, t('auth.acceptInvite.validationPasswordNumber')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.acceptInvite.validationMismatch'),
      path: ['confirmPassword'],
    }),
)

const roleLabel = computed(() =>
  invite.value?.role === 'admin'
    ? t('auth.acceptInvite.roleAdmin')
    : t('auth.acceptInvite.roleMember'),
)

const orgName = computed(
  () => invite.value?.organizationName ?? t('auth.acceptInvite.joinTitleFallback'),
)

onMounted(async () => {
  if (!token.value) {
    checkingInvite.value = false
    return
  }

  try {
    const res = await fetch(`/api/invites/${token.value}`)
    if (res.ok) {
      invite.value = (await res.json()) as Invite
    }
  } finally {
    checkingInvite.value = false
  }
})

async function join() {
  serverError.value = ''
  joining.value = true
  try {
    const res = await fetch(`/api/invites/${token.value}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (res.ok) {
      await router.push('/dashboard')
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? t('common.genericError')
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    joining.value = false
  }
}

async function submit() {
  errors.value = {}
  serverError.value = ''

  const result = schema.value.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      switch (field) {
        case 'name':
          errors.value.name ||= issue.message
          break
        case 'password':
          errors.value.password ||= issue.message
          break
        case 'confirmPassword':
          errors.value.confirmPassword ||= issue.message
          break
      }
    }
    return
  }

  loading.value = true
  try {
    const res = await fetch(`/api/invites/${token.value}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.value.name, password: form.value.password }),
    })

    if (res.ok) {
      await router.push({ name: 'sign-in', query: { invited: 'success' } })
      return
    }

    const data = (await res.json()) as { message?: string }
    serverError.value = data.message ?? t('common.genericError')
  } catch {
    serverError.value = t('common.networkError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-brand-surface flex flex-col items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <div class="flex justify-center mb-8">
        <AppLogo class="h-8" />
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-brand-border p-8">
        <p v-if="checkingInvite" class="text-sm text-gray-500">
          {{ t('auth.acceptInvite.checking') }}
        </p>

        <template v-else-if="invite && invite.accountExists && invite.sessionMatches">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              {{ t('auth.acceptInvite.joinTitle', { org: orgName }) }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              {{ t('auth.acceptInvite.signedInAs', { email: invite.email, role: roleLabel }) }}
            </p>
          </div>

          <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">
            {{ serverError }}
          </p>

          <button
            type="button"
            :disabled="joining"
            class="w-full bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            :class="joining ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
            @click="join"
          >
            {{
              joining
                ? t('auth.acceptInvite.joining')
                : t('auth.acceptInvite.join', { org: orgName })
            }}
          </button>
        </template>

        <template v-else-if="invite && invite.accountExists">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              {{ t('auth.acceptInvite.joinTitle', { org: orgName }) }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              {{ t('auth.acceptInvite.alreadyHaveAccount', { email: invite.email }) }}
            </p>
          </div>

          <RouterLink
            :to="{ path: '/sign-in', query: { redirect: route.fullPath } }"
            class="block w-full text-center bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {{ t('auth.acceptInvite.signInToAccept') }}
          </RouterLink>
        </template>

        <template v-else-if="invite">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-brand-dark">
              {{ t('auth.acceptInvite.joinTitle', { org: orgName }) }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              {{ t('auth.acceptInvite.setPasswordBody', { email: invite.email, role: roleLabel }) }}
            </p>
          </div>

          <form class="space-y-4" @submit.prevent="submit">
            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="name">{{
                t('auth.acceptInvite.nameLabel')
              }}</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                autocomplete="name"
                :placeholder="t('auth.acceptInvite.namePlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.name
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.name" class="text-xs text-red-500 mt-1">{{ errors.name }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="password">{{
                t('auth.acceptInvite.passwordLabel')
              }}</label>
              <input
                id="password"
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                :placeholder="t('auth.acceptInvite.passwordPlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.password
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.password" class="text-xs text-red-500 mt-1">
                {{ errors.password }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-brand-dark mb-1" for="confirmPassword">{{
                t('auth.acceptInvite.confirmLabel')
              }}</label>
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="t('auth.acceptInvite.confirmPlaceholder')"
                class="w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors"
                :class="
                  errors.confirmPassword
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-brand-border focus:border-brand-teal'
                "
              />
              <p v-if="errors.confirmPassword" class="text-xs text-red-500 mt-1">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <p v-if="serverError" class="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {{ serverError }}
            </p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-brand-teal text-white py-2.5 rounded-lg text-sm font-semibold transition-opacity mt-2"
              :class="loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'"
            >
              {{ loading ? t('auth.acceptInvite.submitting') : t('auth.acceptInvite.submit') }}
            </button>
          </form>
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold text-brand-dark mb-2">
            {{ t('auth.acceptInvite.invalidTitle') }}
          </h1>
          <p class="text-sm text-gray-500">
            {{ t('auth.acceptInvite.invalidBody') }}
          </p>
          <RouterLink
            to="/sign-in"
            class="block mt-6 text-sm text-brand-teal font-medium hover:underline"
          >
            {{ t('auth.acceptInvite.backToSignIn') }}
          </RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>
