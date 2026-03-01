<template>
  <div class="w-full min-h-full">
    <div class="min-h-screen bg-[#E5E5E5] text-gray-800 flex flex-col items-center py-24 px-6 relative z-10">
      <div class="w-full max-w-xl bg-white border border-gray-300 p-10 md:p-12 shadow-2xl relative">
      <div class="absolute top-0 left-0 w-full h-2 bg-[#34418F]"></div>

      <div class="border-b-2 border-gray-200 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 class="font-mono text-2xl font-black text-[#34418F] uppercase tracking-widest mb-1">ACCOUNT SETTINGS</h1>
          <p class="font-mono text-xs text-gray-500 uppercase tracking-widest">Security & Credentials</p>
        </div>
        <router-link to="/dashboard" class="font-mono text-xs font-bold text-gray-400 hover:text-[#34418F] uppercase tracking-wider transition-colors">
          ← RETURN TO DASHBOARD
        </router-link>
      </div>

      <form @submit.prevent="handleUpdatePassword" class="space-y-6">
        <div class="flex flex-col gap-2 font-mono">
          <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Current Password</label>
          <input v-model="passwords.current" type="password" required class="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-[#34418F] focus:bg-white transition-colors text-sm" />
        </div>
        <div class="flex flex-col gap-2 font-mono">
          <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">New Password</label>
          <input v-model="passwords.new" type="password" required class="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-[#34418F] focus:bg-white transition-colors text-sm" />
        </div>
        <div class="flex flex-col gap-2 font-mono">
          <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Confirm New Password</label>
          <input v-model="passwords.confirm" type="password" required class="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-[#34418F] focus:bg-white transition-colors text-sm" />
        </div>

        <button type="submit" :disabled="isSaving" :class="{'opacity-70 cursor-not-allowed animate-pulse': isSaving, 'hover:bg-[#c5963b]': !isSaving}" class="w-full mt-4 bg-[#DEAC4B] text-white font-mono text-sm font-bold uppercase tracking-widest py-4 rounded-lg transition-colors">
          {{ isSaving ? 'SAVING...' : 'UPDATE PASSWORD' }}
        </button>
      </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const isSaving = ref(false)
const passwords = reactive({ current: '', new: '', confirm: '' })

const handleUpdatePassword = async () => {
  if (passwords.new !== passwords.confirm) {
    toast.error('New passwords do not match.')
    return
  }

  isSaving.value = true
  try {
    const response = await fetch('https://api.eypi.cc/api/auth/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('eypi_token')}`,
      },
      body: JSON.stringify({
        currentPassword: passwords.current,
        newPassword: passwords.new,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || data.message || 'Failed to update password.')
      return
    }

    toast.success('Password successfully updated')
    passwords.current = ''
    passwords.new = ''
    passwords.confirm = ''
  } catch {
    toast.error('Failed to update password.')
  } finally {
    isSaving.value = false
  }
}
</script>
