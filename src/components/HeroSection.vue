<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center px-6 py-12 md:py-24"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col items-center justify-center text-center">
      <h1
        class="reveal mb-6 font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
        style="font-size: clamp(2.6rem, 6vw, 5.5rem); line-height: 1.05; letter-spacing: -0.03em;"
        data-cursor="text"
      >
        Short links for the <span class="text-[#DEAC4B]">APC</span> community.
      </h1>
      <p
        class="reveal delay-1 mb-8 max-w-2xl text-gray-600 dark:text-slate-400"
        style="font-size: clamp(1.1rem, 2vw, 1.4rem); line-height: 1.65;"
        data-cursor="text"
      >
        Built for student orgs and the college community to claim clean, custom links instantly. Free to use, zero ads.
      </p>
      <div class="reveal delay-2 w-full max-w-3xl">
        <ShortenForm v-model="longUrl" :loading="isShortening" @submit="handleShorten" />
      </div>

      <!-- Visual connector -->
      <div class="reveal delay-3 my-4 flex flex-col items-center justify-center text-[#34418F]/50 dark:text-slate-400 animate-bounce">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      <!-- Live Preview Monitor -->
      <div
        class="reveal delay-4 relative h-28 w-full max-w-3xl rounded-3xl border-2 border-gray-300 bg-gray-50/50 p-3 shadow-2xl dark:border-slate-600 dark:bg-slate-900/30 md:h-36 lg:h-44"
        data-cursor="card"
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
            <span class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200" style="font-size: clamp(1.5rem, 3vw, 2.5rem);">
              eypi.cc/<span class="text-[#DEAC4B] transition-all">{{ previewSlug }}</span>
            </span>
            <router-link
              to="/login"
              class="mt-3 block font-mono text-xs uppercase tracking-widest text-gray-500 transition-colors hover:text-[#DEAC4B] dark:text-slate-400 dark:hover:text-slate-200"
              data-cursor="nav"
            >
              Login to customize →
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
import { useReveal } from '@/composables/useReveal'

useReveal()

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
