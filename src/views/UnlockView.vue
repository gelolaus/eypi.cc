<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 p-8 dark:border-slate-600"
    >
      <PageShell />

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
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          :aria-invalid="Boolean(error)"
          :aria-describedby="error ? 'password-error' : undefined"
        >
        <p
          v-if="error"
          id="password-error"
          role="alert"
          class="mt-1 text-sm text-red-500"
        >
          {{ error }}
        </p>
        <button
          type="submit"
 class="btn-gold mt-6 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
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
import PageShell from '@/components/PageShell.vue'
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
    const res = await fetch(`${API_BASE_URL}/api/links/${encodeURIComponent(slug.value)}/unlock`, {
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
