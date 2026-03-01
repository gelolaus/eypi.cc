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
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

    toast.success(data.message || 'Registration successful.')
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
