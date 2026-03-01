<template>
    <div class="min-h-[calc(100vh-140px)] bg-[#E5E5E5] dark:bg-slate-950 text-gray-800 dark:text-slate-200 flex flex-col items-center justify-center py-12 px-6 relative z-10">
      <div class="w-full max-w-md bg-white dark:bg-mica-navy-card border border-gray-300 dark:border-slate-600 p-10 shadow-2xl relative dark:backdrop-blur-xl">
      <div class="absolute top-0 left-0 w-full h-2 bg-[#34418F]"></div>

      <div class="mb-8 text-center">
        <div class="w-12 h-12 mx-auto mb-4 border-2 border-[#34418F] dark:border-slate-400 flex items-center justify-center text-[#34418F] dark:text-slate-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 class="font-mono text-xl font-black text-gray-900 dark:text-slate-200 uppercase tracking-widest mb-1">RESET PASSWORD</h1>
        <p class="font-mono text-xs text-gray-500 dark:text-slate-400 uppercase tracking-widest">Account Recovery</p>
      </div>

      <form @submit.prevent="handleRecovery" class="space-y-6">
        <div class="flex flex-col gap-2 font-mono">
          <label class="text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
          <input v-model="email" type="email" required placeholder="name@example.com" class="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-[#34418F] focus:bg-white transition-colors text-sm text-center dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500" />
        </div>

        <button type="submit" :disabled="isSending" :class="{'opacity-70 cursor-not-allowed animate-pulse': isSending, 'hover:bg-[#2a3575]': !isSending}" class="w-full bg-[#34418F] text-white font-mono text-sm font-bold uppercase tracking-widest py-4 rounded-lg transition-colors dark:bg-slate-700 dark:hover:bg-slate-600">
          {{ isSending ? 'SENDING...' : 'SEND RECOVERY LINK' }}
        </button>
      </form>

      <div class="mt-8 text-center border-t border-gray-100 pt-6">
        <router-link to="/login" class="font-mono text-xs font-bold text-gray-400 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 uppercase tracking-wider transition-colors">
          ← Back to Login
        </router-link>
      </div>
    </div>
  </div>
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
