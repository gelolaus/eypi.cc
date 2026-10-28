<template>
  <section class="relative flex min-h-dvh w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:py-24">
    <Card class="w-full max-w-md gap-6 rounded-3xl bg-card/80 p-6 shadow-2xl sm:p-8">
      <h1 class="font-display text-3xl font-semibold tracking-tight">
        Accept the privacy policy and terms
      </h1>
      <form
        class="flex flex-col gap-4"
        @submit.prevent="onContinue"
      >
        <label class="flex min-h-11 cursor-pointer items-start gap-3 text-base leading-relaxed text-foreground">
          <input
            id="consent-privacy"
            v-model="acceptPrivacy"
            class="mt-0.5 size-6 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            type="checkbox"
          >
          <span>
            I agree to the
            <router-link
              class="text-primary underline underline-offset-4"
              to="/privacy"
              @click.stop
            >
              Privacy policy
            </router-link>.
          </span>
        </label>
        <label class="flex min-h-11 cursor-pointer items-start gap-3 text-base leading-relaxed text-foreground">
          <input
            id="consent-terms"
            v-model="acceptTerms"
            class="mt-0.5 size-6 shrink-0 cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            type="checkbox"
          >
          <span>
            I agree to the
            <router-link
              class="text-primary underline underline-offset-4"
              to="/terms"
              @click.stop
            >
              Terms
            </router-link>.
          </span>
        </label>
        <p
          v-if="errorMessage"
          class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive"
          role="alert"
        >
          {{ errorMessage }}
        </p>
        <Button
          class="w-full"
          size="lg"
          type="submit"
          :disabled="!canContinue"
        >
          Continue
        </Button>
      </form>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
