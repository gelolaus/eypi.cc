<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_70%)]"
    />

    <Card className="relative w-full max-w-md">
      <h1 class="mb-4 font-display text-2xl font-bold tracking-tight text-g-text">
        Verify your account
      </h1>

      <p
        v-if="error"
        class="mb-6 rounded-xl border border-g-destructive/30 bg-g-destructive/10 px-4 py-3 text-sm text-g-destructive"
      >
        {{ error }}
      </p>

      <p v-else-if="!token" class="mb-6 text-sm leading-relaxed text-g-muted">
        No verification token found. Please use the link from your email.
      </p>

      <template v-else>
        <p class="mb-6 text-sm leading-relaxed text-g-muted">
          Confirm this email to finish setting up your APC account.
        </p>
        <Button
          type="button"
          className="w-full"
          :disabled="isVerifying"
          @click="confirmVerification"
        >
          {{ isVerifying ? 'Verifying...' : 'Confirm verification' }}
        </Button>
      </template>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'

const route = useRoute()
const router = useRouter()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t.trim() : ''
})

const isVerifying = ref(false)
const error = ref('')

async function confirmVerification() {
  if (!token.value || isVerifying.value) return

  isVerifying.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.value }),
    })

    const text = await response.text()
    if (!response.ok) {
      try {
        const data = JSON.parse(text)
        error.value = data.error || data.message || 'Verification failed.'
      } catch {
        error.value = text || 'Verification failed. The link may have expired.'
      }
      return
    }

    router.push('/login?verified=true')
  } catch (err) {
    error.value = 'Network error. Please try again.'
    console.error('Verification failed:', err)
  } finally {
    isVerifying.value = false
  }
}
</script>
