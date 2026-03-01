<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center overflow-hidden px-4"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-600 p-8"
    >
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-4 text-center font-mono text-xl font-bold text-[#34418F] dark:text-slate-200">
        VERIFY YOUR ACCOUNT
      </h2>

      <p
        v-if="error"
        class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-mono text-sm text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
      >
        {{ error }}
      </p>

      <p
        v-else-if="!token"
        class="mb-6 font-mono text-sm text-gray-600 dark:text-slate-400"
      >
        No verification token found. Please use the link from your email.
      </p>

      <template v-else>
        <p class="mb-8 font-mono text-sm text-gray-600 dark:text-slate-400">
          Click the button below to confirm your eypi.cc account verification.
        </p>

        <button
          type="button"
          :disabled="isVerifying"
          :class="[
            'w-full rounded-lg bg-[#DEAC4B] px-4 py-4 font-mono text-base font-bold uppercase tracking-wider text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
            isVerifying ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110',
          ]"
          @click="confirmVerification"
        >
          {{ isVerifying ? 'Verifying...' : 'Confirm Verification' }}
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
    const response = await fetch('https://api.eypi.cc/api/auth/verify', {
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
