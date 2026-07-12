<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <!-- Auth Card -->
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-600 p-8"
    >
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <!-- Top toggles -->
      <div class="mb-6 flex flex-row gap-2">
        <button
          type="button"
          :class="[
            'flex-1 rounded-lg px-4 py-2 font-mono text-sm font-bold transition-colors',
            mode === 'login'
              ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
              : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          @click="mode = 'login'"
        >
          Login
        </button>
        <button
          type="button"
          :class="[
            'flex-1 rounded-lg px-4 py-2 font-mono text-sm font-bold transition-colors',
            mode === 'register'
              ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
              : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          @click="mode = 'register'"
        >
          Register
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="onSubmit" class="flex flex-col">
        <input
          v-if="mode === 'register'"
          v-model="name"
          type="text"
          placeholder="Full Name"
          class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
        />
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          class="mb-6 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
        />

        <!-- Submit button - use plain text, no bracketed formatting for CTAs -->
        <button
          type="submit"
          :disabled="isAuthenticating"
          :class="[
            'w-full rounded-lg bg-[#DEAC4B] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
            isAuthenticating ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110',
          ]"
        >
          {{ isAuthenticating ? 'Processing...' : mode === 'login' ? 'Login' : 'Register' }}
        </button>
        <router-link
          v-if="mode === 'login'"
          to="/reset-password"
          class="mt-4 text-center font-mono text-xs text-gray-500 transition-colors hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200"
        >
          Need password help?
        </router-link>
      </form>
    </div>

    <!-- Verification Modal -->
    <div
      v-if="showVerificationModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm dark:bg-slate-900/80"
      role="dialog"
      aria-labelledby="verification-modal-title"
      aria-modal="true"
    >
      <div class="mica-card w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-8 text-left">
        <h3 id="verification-modal-title" class="mb-3 text-xl font-bold text-g-text">
          Check your inbox
        </h3>
        <p class="mb-4 text-sm leading-relaxed text-g-text">
          We sent a verification link to your APC email. Verify before you log in.
        </p>
        <p class="mb-6 text-sm leading-relaxed text-g-muted">
          Delivery can take up to 10 minutes. Resend's free plan queues slowly, and APC's mail filters often hold new messages. Check Spam or Junk if it is not in your inbox. Still missing after 10 minutes? Message arlaus on Microsoft Teams.
        </p>
        <button
          type="button"
          class="w-full rounded-lg bg-g-accent px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          @click="showVerificationModal = false"
        >
          Got it
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, watch, type Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { API_BASE_URL } from '@/config/api'
import type AppTransition from '@/components/AppTransition.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const appTransition = inject<Ref<InstanceType<typeof AppTransition> | null>>('appTransition')

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const isAuthenticating = ref(false)
const showVerificationModal = ref(false)

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab === 'register') {
      mode.value = 'register'
    } else {
      mode.value = 'login'
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (route.query.verified === 'true') {
    toast.success('Email verified! You can now log in.')
    router.replace({ path: '/login', query: {} })
  }
})

const handleLogin = async () => {
  if (!email.value.trim() || !email.value.includes('@')) {
    toast.error('Please enter a valid email address.')
    return
  }
  if (password.value.length < 8) {
    toast.error('Password must be at least 8 characters.')
    return
  }
  isAuthenticating.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Authentication failed')
    }

    localStorage.setItem('eypi_token', data.token)
    // Verify token is stored before navigation so the route guard allows access
    if (localStorage.getItem('eypi_token')) {
      toast.success('Welcome back.')
      if (appTransition?.value?.trigger) {
        await appTransition.value.trigger()
      }
      router.push('/dashboard')
    } else {
      throw new Error('Failed to store authentication token')
    }
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Authentication failed')
    password.value = ''
  } finally {
    isAuthenticating.value = false
  }
}

const PW_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

const handleRegister = async () => {
  if (!email.value.trim() || !email.value.includes('@')) {
    toast.error('Please enter a valid email address.')
    return
  }
  if (!PW_PATTERN.test(password.value)) {
    toast.error('Password must be 8+ chars with uppercase, lowercase, a number, and a symbol.')
    return
  }
  if (name.value.trim().length > 200) {
    toast.error('Name is too long.')
    return
  }
  isAuthenticating.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value, name: name.value.trim() || undefined }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed')
    }

    showVerificationModal.value = true
    mode.value = 'login'
    password.value = ''
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Registration failed')
    password.value = ''
  } finally {
    isAuthenticating.value = false
  }
}

function onSubmit(): void {
  if (mode.value === 'login') {
    handleLogin()
  } else {
    handleRegister()
  }
}
</script>
