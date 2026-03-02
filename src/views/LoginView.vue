<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center overflow-hidden px-4"
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

      <!-- Header -->
      <h2 class="mb-6 text-center font-mono text-xl font-bold text-[#34418F] dark:text-slate-200">
        {{ mode === 'login' ? 'LOGIN' : 'REGISTER' }}
      </h2>

      <!-- Form -->
      <form @submit.prevent="onSubmit" class="flex flex-col">
        <input
          v-if="mode === 'register'"
          v-model="name"
          type="text"
          placeholder="Full Name"
          class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
        />
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
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
            'w-full rounded-lg bg-[#DEAC4B] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
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
          Forgot password?
        </router-link>
        <p v-if="mode === 'login'" class="mt-4 text-center font-mono text-sm text-gray-600 dark:text-slate-400">
          Don't have an account yet?
          <span
            class="text-eypi-gold hover:underline cursor-pointer font-semibold"
            @click="mode = 'register'"
          >
            Register here
          </span>
        </p>
        <p v-else class="mt-4 text-center font-mono text-sm text-gray-600 dark:text-slate-400">
          Already have an account?
          <span
            class="text-eypi-gold hover:underline cursor-pointer font-semibold"
            @click="mode = 'login'"
          >
            Log in
          </span>
        </p>
      </form>
    </div>

    <!-- Verification Modal -->
    <div
      v-if="showVerificationModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-slate-900/80 backdrop-blur-sm p-4"
    >
      <div class="mica-card max-w-md w-full p-8 text-center rounded-2xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-mica-navy-modal">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mx-auto mb-4 w-12 h-12 text-sky-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h3 class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Check Your Inbox!</h3>
        <p class="text-slate-600 dark:text-slate-300 mb-4">
          We've sent a verification link to your APC email. <strong>You must verify your account before you can log in.</strong>
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Note: Enterprise email filters may delay the message by 1 to 5 minutes. Please check your Spam/Junk folder. <strong>If you still do not receive an email, please send a message to arlaus on Microsoft Teams.</strong>
        </p>
        <button
          type="button"
          @click="showVerificationModal = false"
          class="w-full rounded-lg bg-[#DEAC4B] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
        >
          Got it!
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const toast = useToast()

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
  isAuthenticating.value = true

  try {
    const response = await fetch('https://api.eypi.cc/api/auth/login', {
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
      toast.success('Access granted. Welcome back.')
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

const handleRegister = async () => {
  isAuthenticating.value = true

  try {
    const response = await fetch('https://api.eypi.cc/api/auth/register', {
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
