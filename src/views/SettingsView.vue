<template>
  <section class="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
    <Card>
      <h2 class="font-display text-xl font-semibold text-g-text">
        Password requirements
      </h2>
      <ul class="mt-4 space-y-3 text-sm leading-relaxed text-g-muted">
        <li class="border-t border-g-border pt-3">At least 8 characters</li>
        <li class="border-t border-g-border pt-3">One uppercase and one lowercase letter</li>
        <li class="border-t border-g-border pt-3">One number and one symbol</li>
      </ul>
    </Card>

    <Card>
      <form @submit.prevent="handleUpdatePassword">
        <h2 class="mb-8 font-display text-xl font-semibold text-g-text">
          Update password
        </h2>

        <div class="space-y-5">
          <div class="flex flex-col gap-2">
            <label for="current-password" class="text-sm font-medium text-g-muted">Current password</label>
            <Input
              id="current-password"
              :value="passwords.current"
              type="password"
              autocomplete="current-password"
              :aria-invalid="Boolean(errors.current)"
              :aria-describedby="errors.current ? 'current-password-error' : undefined"
              @input="onCurrentInput"
            />
            <p v-if="errors.current" id="current-password-error" class="text-sm text-g-destructive">{{ errors.current }}</p>
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label for="new-password" class="text-sm font-medium text-g-muted">New password</label>
              <Input
                id="new-password"
                :value="passwords.new"
                type="password"
                autocomplete="new-password"
                :aria-invalid="Boolean(errors.new)"
                :aria-describedby="errors.new ? 'new-password-error' : undefined"
                @input="onNewInput"
              />
              <p v-if="errors.new" id="new-password-error" class="text-sm text-g-destructive">{{ errors.new }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label for="confirm-password" class="text-sm font-medium text-g-muted">Confirm new password</label>
              <Input
                id="confirm-password"
                :value="passwords.confirm"
                type="password"
                autocomplete="new-password"
                :aria-invalid="Boolean(errors.confirm)"
                :aria-describedby="errors.confirm ? 'confirm-password-error' : undefined"
                @input="onConfirmInput"
              />
              <p v-if="errors.confirm" id="confirm-password-error" class="text-sm text-g-destructive">{{ errors.confirm }}</p>
            </div>
          </div>
        </div>

        <Button type="submit" className="mt-8 w-full" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Update password' }}
        </Button>
      </form>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { API_BASE_URL } from '@/config/api'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

const toast = useToast()
const isSaving = ref(false)
const passwords = reactive({ current: '', new: '', confirm: '' })
const errors = reactive({ current: '', new: '', confirm: '' })

function onCurrentInput(e: Event) {
  passwords.current = (e.target as HTMLInputElement).value
}
function onNewInput(e: Event) {
  passwords.new = (e.target as HTMLInputElement).value
}
function onConfirmInput(e: Event) {
  passwords.confirm = (e.target as HTMLInputElement).value
}

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
