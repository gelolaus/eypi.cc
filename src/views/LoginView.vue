<template>
  <section
    class="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:py-24"
  >
    <div class="mica-card w-full max-w-md rounded-3xl border border-g-border p-6 sm:p-8">
      <h1 class="text-section-title text-g-text">
        Sign in to eypi.cc
      </h1>
      <p class="mt-3 text-sm leading-relaxed text-g-muted">
        Use your APC Microsoft 365 account (@apc.edu.ph or @student.apc.edu.ph).
      </p>
      <p
        v-if="errorMessage"
        id="sign-in-error"
        role="alert"
        class="mt-4 text-sm text-red-600 dark:text-red-400"
      >
        {{ errorMessage }}
      </p>
      <a
        :href="signInHref"
        class="mt-6 inline-flex h-12 min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8C8C8C] bg-white px-4 text-base font-semibold text-[#5E5E5E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 21 21"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width="9"
            height="9"
            fill="#f25022"
          />
          <rect
            x="11"
            y="1"
            width="9"
            height="9"
            fill="#7fba00"
          />
          <rect
            x="1"
            y="11"
            width="9"
            height="9"
            fill="#00a4ef"
          />
          <rect
            x="11"
            y="11"
            width="9"
            height="9"
            fill="#ffb900"
          />
        </svg>
        Sign in with Microsoft
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE_URL } from '@/config/api'

const route = useRoute()

const ERROR_COPY: Record<string, string> = {
  tenant: 'Only APC Microsoft 365 accounts can sign in.',
  domain: 'Only APC Microsoft 365 accounts can sign in.',
  cancelled: 'Sign-in was cancelled.',
  state: 'Your sign-in link expired. Try again.',
  disabled: 'This account is disabled. Contact the eypi.cc admin.',
  server: 'Something went wrong signing you in. Try again.',
}

function queryValue(key: string): string {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value : ''
}

const errorMessage = computed(() => ERROR_COPY[queryValue('error')] ?? '')

const returnTo = computed(() => {
  const value = queryValue('returnTo')
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  return '/dashboard'
})

const signInHref = computed(
  () => `${API_BASE_URL}/api/auth/microsoft/start?returnTo=${encodeURIComponent(returnTo.value)}`,
)
</script>
