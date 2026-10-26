<template>
  <section
    class="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 p-6 sm:p-8 dark:border-slate-600"
    >

      <h1 class="text-section-title mb-2 text-center text-[#34418F] dark:text-slate-200">
        This link is password protected
      </h1>
      <p class="text-data mb-6 text-center text-sm text-gray-500 dark:text-slate-400">
        {{ slug }}
      </p>

      <form
        class="flex flex-col"
        @submit.prevent="onSubmit"
      >
        <label
          for="unlock-password"
          class="mb-1 text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Password
        </label>
        <input
          id="unlock-password"
          v-model="password"
          type="password"
          name="password"
          autocomplete="current-password"
          class="control h-11 font-mono text-base"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'password-error' : undefined"
        >
        <p
          v-if="error"
          id="password-error"
          role="alert"
          class="mt-2 text-sm text-red-600 dark:text-red-400"
        >
          {{ error }}
        </p>
        <button
          type="submit"
          class="btn-primary btn-lg mt-6 w-full"
          :disabled="pending"
        >
          Continue
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { API_BASE_URL } from '@/config/api'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
const password = ref('')
const error = ref('')
const pending = ref(false)

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/links/${encodeURIComponent(slug.value)}/unlock${route.query.src === 'qr' ? '?src=qr' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: password.value }),
    })
    const data = await res.json() as {
      url?: string
      error?: { message?: string; fields?: { password?: string } }
    }
    if (!res.ok || typeof data.url !== 'string' || !data.url) {
      error.value = data.error?.fields?.password || data.error?.message || 'That password is wrong.'
      return
    }
    location.replace(data.url)
  } catch {
    error.value = 'Could not check that password. Try again.'
  } finally {
    pending.value = false
  }
}
</script>
