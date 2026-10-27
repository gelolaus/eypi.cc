<template>
  <section class="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:py-24">
    <BrandLogo
      to="/"
      class="mb-8"
    />
    <Card class="w-full max-w-md gap-6 rounded-3xl bg-card/80 p-6 shadow-[0_24px_80px_-40px_rgba(53,67,140,0.3)] sm:p-8">
      <div class="space-y-3">
        <h1 class="font-display text-3xl font-semibold tracking-tight">
          Sign in to Eypi
        </h1>
        <p class="text-base leading-relaxed text-muted-foreground">
          Use your APC Microsoft 365 account (@apc.edu.ph or @student.apc.edu.ph).
        </p>
      </div>
      <p
        v-if="errorMessage"
        id="sign-in-error"
        role="alert"
        class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive"
      >
        {{ errorMessage }}
      </p>
      <Button
        as-child
        size="lg"
        class="h-12 w-full"
      >
        <a :href="signInHref">
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
      </Button>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { API_BASE_URL } from '@/config/api'

const route = useRoute()

const ERROR_COPY: Record<string, string> = {
  tenant: 'Only APC Microsoft 365 accounts can sign in.',
  domain: 'Only APC Microsoft 365 accounts can sign in.',
  cancelled: 'Sign-in was cancelled.',
  state: 'Your sign-in link expired. Try again.',
  disabled: 'This account is disabled. Contact the Eypi admin.',
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
