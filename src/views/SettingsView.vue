<template>
  <section class="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <aside class="reveal delay-1 mica-card rounded-3xl p-7 shadow-sm">
        <h2 class="text-section-title mb-4 text-g-primary dark:text-white">
          Password requirements
        </h2>
        <ul class="space-y-3 text-sm leading-relaxed text-g-muted">
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
          <h2 class="text-section-title text-g-text">
            Update password
          </h2>
        </div>

        <div class="space-y-5">
          <div class="flex flex-col gap-2">
            <label for="current-password" class="text-sm font-medium text-g-muted">Current password</label>
            <input
              id="current-password"
              v-model="passwords.current"
              type="password"
              autocomplete="current-password"
              class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
              :aria-invalid="Boolean(errors.current)"
              :aria-describedby="errors.current ? 'current-password-error' : undefined"
            />
            <p v-if="errors.current" id="current-password-error" class="text-sm text-red-500">{{ errors.current }}</p>
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label for="new-password" class="text-sm font-medium text-g-muted">New password</label>
              <input
                id="new-password"
                v-model="passwords.new"
                type="password"
                autocomplete="new-password"
                class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
                :aria-invalid="Boolean(errors.new)"
                :aria-describedby="errors.new ? 'new-password-error' : undefined"
              />
              <p v-if="errors.new" id="new-password-error" class="text-sm text-red-500">{{ errors.new }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label for="confirm-password" class="text-sm font-medium text-g-muted">Confirm new password</label>
              <input
                id="confirm-password"
                v-model="passwords.confirm"
                type="password"
                autocomplete="new-password"
                class="rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
                :aria-invalid="Boolean(errors.confirm)"
                :aria-describedby="errors.confirm ? 'confirm-password-error' : undefined"
              />
              <p v-if="errors.confirm" id="confirm-password-error" class="text-sm text-red-500">{{ errors.confirm }}</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isSaving"
          :class="{ 'opacity-70 cursor-not-allowed animate-pulse': isSaving, 'hover:-translate-y-0.5 hover:opacity-90': !isSaving }"
          class="mt-8 w-full rounded-xl bg-g-accent px-6 py-4 text-sm font-semibold text-white transition-all dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          data-cursor="cta"
        >
          {{ isSaving ? 'Saving...' : 'Update password' }}
        </button>
      </form>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { useReveal } from '@/composables/useReveal'
import { API_BASE_URL } from '@/config/api'

const toast = useToast()
useReveal()
const isSaving = ref(false)
const passwords = reactive({ current: '', new: '', confirm: '' })
const errors = reactive({ current: '', new: '', confirm: '' })

watch(() => passwords.current, () => { errors.current = '' })
watch(() => passwords.new, () => { errors.new = '' })
watch(() => passwords.confirm, () => { errors.confirm = '' })

const PW_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

const handleUpdatePassword = async () => {
  if (!passwords.current) {
    errors.current = 'Enter your current password.'
    return
  }
  if (!PW_PATTERN.test(passwords.new)) {
    errors.new = 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.'
    return
  }
  if (passwords.new !== passwords.confirm) {
    errors.confirm = 'Re-enter the new password so both fields match.'
    return
  }

  isSaving.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
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

    toast.success('Password updated')
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
