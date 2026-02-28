<template>
  <div
    class="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-16"
  >
    <!-- Top Bar (Create Link) -->
    <div class="mb-10 flex w-full gap-4">
      <input
        v-model="longUrlInput"
        type="url"
        placeholder="Paste your long link here..."
        class="flex-1 rounded-xl border-2 border-gray-200 bg-white/40 px-6 py-4 font-mono shadow-inner outline-none backdrop-blur-md transition-colors focus:border-[#34418F]"
      />
      <button
        type="button"
        class="rounded-xl bg-[#DEAC4B] px-8 py-4 font-bold uppercase tracking-wider text-white transition-all hover:scale-105"
        @click="openSidebar()"
      >
        Shorten
      </button>
    </div>

    <!-- Unified Table -->
    <div
      class="mica-card w-full overflow-hidden rounded-2xl border border-gray-200 shadow-sm"
    >
      <!-- Table Header -->
      <div
        class="flex items-center justify-between border-b border-gray-200 bg-white/40 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-gray-500"
      >
        <span class="flex-1">Branded Link</span>
        <span class="w-32 text-center">Engagement</span>
        <span class="w-24 text-center">Actions</span>
      </div>

      <!-- Table Rows -->
      <div
        v-for="link in mockLinks"
        :key="link.id"
        class="flex items-center justify-between border-b border-gray-100 px-6 py-5 transition-colors last:border-0 hover:bg-white/50"
      >
        <div class="flex flex-1 flex-col truncate pr-4">
          <span class="font-mono text-lg font-bold text-[#34418F]">
            {{ link.short }}
          </span>
          <span class="truncate font-mono text-sm text-gray-500">
            {{ link.original }}
          </span>
        </div>
        <div class="w-32 text-center font-mono text-sm text-gray-600">
          {{ link.clicks ?? 0 }} clicks
        </div>
        <div class="flex w-24 items-center justify-center gap-2">
          <button
            type="button"
            class="rounded-full p-2 text-blue-500 transition-colors hover:bg-gray-100 hover:text-blue-700"
            aria-label="Edit"
            @click="openSidebar(link)"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-full p-2 text-red-500 transition-colors hover:bg-gray-100 hover:text-red-700"
            aria-label="Delete"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Backdrop (separate fade transition) -->
    <Transition name="fade">
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        aria-hidden="true"
        @click="isSidebarOpen = false"
      />
    </Transition>

    <!-- Slide-out Panel (separate slide-right transition) -->
    <Transition name="slide-right">
      <div
        v-if="isSidebarOpen"
        class="mica-card fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-300 p-8 shadow-2xl"
      >
        <button
          type="button"
          class="absolute right-6 top-6 font-mono text-2xl text-gray-500 transition-colors hover:text-gray-700"
          aria-label="Close"
          @click="isSidebarOpen = false"
        >
          &times;
        </button>

        <h2 class="mb-8 font-mono text-2xl font-black uppercase tracking-widest text-[#34418F]">
          Link Configuration
        </h2>

        <div class="flex flex-1 flex-col">
          <!-- Original Link Input -->
          <input
            v-model="sidebarOriginalUrl"
            type="url"
            placeholder="Original URL"
            class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F]"
          />

          <!-- Arrow -->
          <div class="my-4 text-center font-black text-[#34418F] text-4xl">
            &darr;
          </div>

          <!-- Custom Slug Input (eypi.cc/ prefix + slug) -->
          <div class="mb-6 flex items-center rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus-within:border-[#34418F]">
            <span class="shrink-0 font-mono font-bold text-[#34418F]">eypi.cc/</span>
            <input
              v-model="sidebarSlug"
              type="text"
              placeholder="custom-slug"
              class="min-w-0 flex-1 border-0 bg-transparent font-mono outline-none"
            />
          </div>

          <!-- Save Button -->
          <button
            type="button"
            class="mt-auto w-full rounded-xl bg-[#DEAC4B] px-8 py-4 font-bold uppercase tracking-wider text-white transition-all hover:scale-[1.02]"
            @click="onSave"
          >
            Save
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Link {
  id: number
  original: string
  short: string
  clicks?: number
}

const longUrlInput = ref('')
const isSidebarOpen = ref(false)
const activeLink = ref<Link | null>(null)
const sidebarOriginalUrl = ref('')
const sidebarSlug = ref('')

const mockLinks = ref<Link[]>([
  { id: 1, original: 'https://github.com/gelolaus', short: 'eypi.cc/gelo', clicks: 14 },
  { id: 2, original: 'https://google.com', short: 'eypi.cc/search', clicks: 0 },
])

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function hashToSlug(str: string): string {
  if (!str.trim()) return ''
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i)
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

function extractSlug(short: string): string {
  const prefix = 'eypi.cc/'
  return short.startsWith(prefix) ? short.slice(prefix.length) : short
}

function openSidebar(link?: Link): void {
  activeLink.value = link ?? null
  if (link) {
    sidebarOriginalUrl.value = link.original
    sidebarSlug.value = extractSlug(link.short)
  } else {
    sidebarOriginalUrl.value = longUrlInput.value
    sidebarSlug.value = hashToSlug(longUrlInput.value)
  }
  isSidebarOpen.value = true
}

function onSave(): void {
  const short = sidebarSlug.value.trim()
    ? `eypi.cc/${sidebarSlug.value.trim()}`
    : `eypi.cc/${hashToSlug(sidebarOriginalUrl.value)}`
  if (activeLink.value) {
    const idx = mockLinks.value.findIndex((l) => l.id === activeLink.value!.id)
    if (idx !== -1) {
      mockLinks.value[idx] = {
        ...activeLink.value,
        original: sidebarOriginalUrl.value,
        short,
      }
    }
  } else {
    mockLinks.value.push({
      id: Math.max(0, ...mockLinks.value.map((l) => l.id)) + 1,
      original: sidebarOriginalUrl.value,
      short,
      clicks: 0,
    })
  }
  isSidebarOpen.value = false
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
