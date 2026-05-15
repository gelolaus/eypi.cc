<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-600 p-8"
    >
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <!-- Header -->
      <h2 class="mb-2 text-center font-mono text-xl font-bold text-[#34418F] dark:text-slate-200">
        RESET PASSWORD
      </h2>
      <p class="mb-8 text-center font-mono text-xs text-gray-500 dark:text-slate-400">
        Enter your email and we'll send a recovery link.
      </p>

      <!-- Form -->
      <form @submit.prevent="handleRecovery" class="flex flex-col">
        <input
          v-model="email"
          type="email"
          required
          placeholder="Email"
          class="mb-6 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          data-cursor="text"
        />

        <button
          type="submit"
          :disabled="isSending"
          :class="[
            'w-full rounded-lg bg-[#DEAC4B] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
            isSending ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110',
          ]"
          data-cursor="cta"
        >
          {{ isSending ? 'Sending...' : 'Send Recovery Link' }}
        </button>

        <router-link
          to="/login"
          class="mt-6 text-center font-mono text-xs text-gray-500 transition-colors hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200"
          data-cursor="nav"
        >
          ← Back to Login
        </router-link>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const router = useRouter()
const isSending = ref(false)
const email = ref('')

const handleRecovery = () => {
  isSending.value = true
  setTimeout(() => {
    isSending.value = false
    toast.success('If an account exists with that email, you will receive a recovery link.')
    router.push('/login')
  }, 1200)
}
</script>
