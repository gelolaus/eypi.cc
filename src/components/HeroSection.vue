<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center px-4 py-10 md:py-20"
  >
    <div class="mx-auto flex max-w-4xl flex-col items-center justify-center text-center">
      <h1
        class="mb-4 font-mono text-5xl font-black tracking-tight text-[#34418F] dark:text-slate-200 md:mb-6 md:text-7xl"
      >
        Short links for the <span class="text-[#DEAC4B]">APC</span> community.
      </h1>
      <p class="mb-4 max-w-3xl text-xl text-gray-600 dark:text-slate-400 md:mb-6 md:text-2xl">
        Built for student orgs and the college community to claim clean, custom links instantly. Free to use, zero ads.
      </p>
      <ShortenForm v-model="longUrl" :loading="isShortening" @submit="handleShorten" />

      <!-- Visual connector (the flow) -->
      <div class="my-2 flex flex-col items-center justify-center text-[#34418F]/50 dark:text-slate-400 animate-bounce md:my-4">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      <!-- Live Preview Monitor -->
      <div
        class="relative h-24 w-full max-w-3xl rounded-3xl border-2 border-gray-300 bg-gray-50/50 p-3 shadow-2xl dark:border-slate-600 dark:bg-slate-900/30 md:h-32 lg:h-40"
      >
        <div
          class="mica-card relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl p-4"
        >
          <!-- Corner screws -->
          <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
          <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
          <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
          <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

          <!-- Single output monitor -->
          <div class="flex flex-col items-center justify-center w-full h-full">
            <span class="font-mono text-2xl font-black tracking-tight text-[#34418F] dark:text-slate-200 md:text-3xl">
              eypi.cc/<span class="text-[#DEAC4B] transition-all">{{ previewSlug }}</span>
            </span>
            <router-link
              to="/login"
              class="mt-3 block font-mono text-xs uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 md:text-sm"
            >
              Login to customize
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import ShortenForm from './ShortenForm.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()
const longUrl = ref('')
const isShortening = ref(false)

const normalizeUrl = (url: string): string => {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

const isValidUrl = (url: string) => {
  const pattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/
  return pattern.test(url.trim())
}

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function hashToSlug(str: string): string {
  if (!str.trim()) return '...'
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash | 0
  }
  const n = Math.abs(hash)
  let result = ''
  let remaining = n
  for (let i = 0; i < 5; i++) {
    result = BASE62[remaining % 62] + result
    remaining = Math.floor(remaining / 62)
  }
  return result
}

const previewSlug = computed(() => hashToSlug(longUrl.value))

function handleShorten(): void {
  const urlToProcess = normalizeUrl(longUrl.value)
  if (!urlToProcess) return

  if (!isValidUrl(urlToProcess)) {
    toast.error('Please enter a valid URL')
    return
  }

  const token = localStorage.getItem('eypi_token')
  if (token) {
    router.push({ path: '/dashboard', query: { url: urlToProcess } })
  } else {
    localStorage.setItem('pending_url', urlToProcess)
    toast.error('Please log in to shorten your link!')
    router.push('/login')
  }
}
</script>
