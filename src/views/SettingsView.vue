<template>
  <section class="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <aside class="reveal delay-1 mica-card rounded-3xl p-7 shadow-sm">
        <p class="mb-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.3em] text-g-accent">
          credential policy
        </p>
        <h2 class="mb-4 font-mono text-xl font-semibold uppercase tracking-[0.1em] text-g-primary dark:text-white">
          Password requirements
        </h2>
        <ul class="space-y-3 font-mono text-sm leading-relaxed text-g-muted">
          <li class="border-t border-g-border pt-3">At least 8 characters</li>
          <li class="border-t border-g-border pt-3">One uppercase and one lowercase letter</li>
          <li class="border-t border-g-border pt-3">One number and one symbol</li>
        </ul>
      </aside>

      <form
        class="reveal delay-2 mica-card rounded-3xl p-6 shadow-sm sm:p-8"
        @submit.prevent="handleUpdatePassword"
      >
        <div class="mb-8">
          <p class="mb-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-g-muted">
            Security action
          </p>
          <h2 class="font-mono text-2xl font-semibold uppercase tracking-[0.08em] text-g-text">
            Update password
          </h2>
        </div>

        <div class="space-y-5">
          <div class="flex flex-col gap-2 font-mono">
            <label for="current-password" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Current Password</label>
            <input
              id="current-password"
              v-model="passwords.current"
              type="password"
              required
              autocomplete="current-password"
              class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
            />
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div class="flex flex-col gap-2 font-mono">
              <label for="new-password" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">New Password</label>
              <input
                id="new-password"
                v-model="passwords.new"
                type="password"
                required
                autocomplete="new-password"
                class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>

            <div class="flex flex-col gap-2 font-mono">
              <label for="confirm-password" class="text-xs font-bold uppercase tracking-[0.08em] text-g-muted">Confirm New Password</label>
              <input
                id="confirm-password"
                v-model="passwords.confirm"
                type="password"
                required
                autocomplete="new-password"
                class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isSaving"
          :class="{ 'opacity-70 cursor-not-allowed animate-pulse': isSaving, 'hover:-translate-y-0.5 hover:opacity-90': !isSaving }"
          class="mt-8 w-full rounded-xl bg-g-accent px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.16em] text-white transition-all dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          data-cursor="cta"
        >
          {{ isSaving ? 'SAVING...' : 'UPDATE PASSWORD' }}
        </button>
      </form>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useToast } from '@/composables/useToast'
import { useReveal } from '@/composables/useReveal'

const toast = useToast()
useReveal()
const isSaving = ref(false)
const passwords = reactive({ current: '', new: '', confirm: '' })

const PW_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

const handleUpdatePassword = async () => {
  if (!passwords.current) {
    toast.error('Please enter your current password.')
    return
  }
  if (!PW_PATTERN.test(passwords.new)) {
    toast.error('New password must be 8+ chars with uppercase, lowercase, a number, and a symbol.')
    return
  }
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
