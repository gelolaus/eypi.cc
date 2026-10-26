<template>
  <section class="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-24">
    <div class="mica-card w-full max-w-md rounded-3xl border border-g-border p-8">
      <h1 class="text-section-title text-g-text">
        Accept the privacy policy and terms
      </h1>
      <form
        class="mt-6 flex flex-col gap-4"
        @submit.prevent="onContinue"
      >
        <div class="flex items-start gap-3">
          <input
            id="consent-privacy"
            v-model="acceptPrivacy"
            class="mt-1 h-4 w-4 shrink-0 accent-g-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            type="checkbox"
          >
          <label
            class="text-sm leading-relaxed text-g-text"
            for="consent-privacy"
          >
            I agree to the
            <router-link
              class="underline underline-offset-4"
              to="/privacy"
              @click.stop
            >
              Privacy policy
            </router-link>.
          </label>
        </div>
        <div class="flex items-start gap-3">
          <input
            id="consent-terms"
            v-model="acceptTerms"
            class="mt-1 h-4 w-4 shrink-0 accent-g-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
            type="checkbox"
          >
          <label
            class="text-sm leading-relaxed text-g-text"
            for="consent-terms"
          >
            I agree to the
            <router-link
              class="underline underline-offset-4"
              to="/terms"
              @click.stop
            >
              Terms
            </router-link>.
          </label>
        </div>
        <p
          v-if="errorMessage"
          class="text-sm text-red-500"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <button
          class="btn-gold min-h-[44px] w-full rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          :disabled="!canContinue"
        >
          Continue
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, api } from '@/lib/api'
import { useSession } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSession()

const acceptPrivacy = ref(false)
const acceptTerms = ref(false)
const pending = ref(false)
const errorMessage = ref('')

const canContinue = computed(() => acceptPrivacy.value && acceptTerms.value && !pending.value)

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 32 || code === 127) return true
  }
  return false
}

function sameOriginReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (value.length === 0 || value.length > 2048) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  if (value.includes('\\')) return '/'
  if (value.includes('://')) return '/'
  if (hasControlCharacter(value)) return '/'
  return value
}

const destination = computed(() => sameOriginReturnTo(route.query.returnTo))

async function onContinue() {
  if (!acceptPrivacy.value || !acceptTerms.value || pending.value) return
  errorMessage.value = ''
  pending.value = true
  try {
    await api.post('/api/legal/consent', { documents: ['privacy', 'terms'] })
    await session.reload()
    await router.replace(destination.value)
  } catch (error) {
    errorMessage.value = error instanceof ApiError
      ? error.message
      : 'Could not save your agreement. Try again.'
  } finally {
    pending.value = false
  }
}
</script>
