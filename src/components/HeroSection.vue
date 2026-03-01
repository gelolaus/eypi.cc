<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center overflow-hidden px-4"
  >
    <!-- Corner registration marks -->
    <div
      class="pointer-events-none absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-gray-300"
    />
    <div
      class="pointer-events-none absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-gray-300"
    />
    <div
      class="pointer-events-none absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-gray-300"
    />
    <div
      class="pointer-events-none absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-gray-300"
    />

    <!-- Pasay coordinates - left edge -->
    <div
      class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-xs text-gray-400"
    >
      COORD. 14.531105 N // 121.021309 E
    </div>

    <div class="mx-auto flex max-w-4xl flex-col items-center text-center">
      <h1
        class="mb-6 font-mono text-5xl font-black tracking-tight text-[#34418F] md:text-7xl"
      >
        Short links for the <span class="text-[#DEAC4B]">APC</span> community.
      </h1>
      <p class="mb-6 max-w-3xl text-xl text-gray-600 md:text-2xl">
        Built for student orgs and the college community to claim clean, custom links instantly. Free to use, zero ads.
      </p>
      <ShortenForm v-model="longUrl" :loading="isShortening" @submit="handleShorten" />

      <!-- Visual connector (the flow) -->
      <div class="my-4 flex flex-col items-center justify-center text-[#34418F]/50 animate-bounce">
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      <!-- Live Preview Monitor -->
      <div
        class="relative h-32 w-full max-w-3xl rounded-3xl border-2 border-gray-300 bg-gray-50/50 p-3 shadow-2xl md:h-40"
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
            <span class="font-mono text-2xl font-black tracking-tight text-[#34418F] md:text-3xl">
              eypi.cc/<span class="text-[#DEAC4B] transition-all">{{ previewSlug }}</span>
            </span>
            <router-link
              to="/login"
              class="mt-3 block font-mono text-xs uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-700 md:text-sm"
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
  let urlToProcess = longUrl.value.trim()
  if (!urlToProcess) return

  if (!/^https?:\/\//i.test(urlToProcess)) {
    urlToProcess = `https://${urlToProcess}`
  }

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
