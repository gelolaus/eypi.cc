<template>
  <div class="relative w-full">
    <div
      class="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-8 pb-24 md:pt-16 md:pb-32"
    >
    <header class="mb-8 flex w-full flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1
          class="text-page-title"
          data-cursor="text"
        >
          Links
        </h1>
      </div>
    </header>

    <!-- Top Bar (Create Link) -->
    <div class="mb-10 flex w-full flex-col gap-4 md:flex-row">
      <input
        v-model="longUrlInput"
        type="url"
        placeholder="Paste your long link here..."
        class="flex-1 rounded-xl border-2 border-gray-200 bg-white px-6 py-4 font-mono text-slate-900 shadow-inner outline-none transition-colors placeholder-slate-500 focus:border-g-accent dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-slate-500"
      />
      <button
        type="button"
        class="rounded-xl bg-[#DEAC4B] px-8 py-4 font-semibold text-white transition-all dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
        :disabled="isShortening"
        :class="{ 'opacity-70 cursor-not-allowed animate-pulse': isShortening, 'hover:scale-105': !isShortening }"
        @click="handleShorten"
      >
        {{ isShortening ? 'Processing...' : 'Shorten' }}
      </button>
    </div>

    <input
      v-model="searchQuery"
      type="search"
      placeholder="Search links..."
      class="mb-6 w-full rounded-2xl border-2 border-g-border bg-g-surface px-6 py-4 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent"
    />

    <!-- Unified Table (horizontal scroll on mobile) -->
    <div class="w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
    <div
      class="mica-card w-full min-w-[600px] overflow-hidden rounded-2xl border border-g-border shadow-sm"
    >
      <!-- Table Header -->
      <div
        class="flex items-center justify-between border-b border-g-border bg-white/40 px-4 md:px-6 py-3 text-data text-xs font-semibold text-g-muted dark:bg-mica-navy-header"
      >
        <span class="flex-1">Short link</span>
        <span class="w-32 text-center">Clicks</span>
        <span class="w-40 text-center">Actions</span>
      </div>

      <!-- Table Rows -->
      <template v-if="filteredLinks.length > 0">
        <div
          v-for="link in filteredLinks"
          :key="link.id"
          class="flex items-center justify-between border-b border-g-border px-4 md:px-6 py-5 transition-colors last:border-0 hover:bg-white/50 dark:border-slate-700/30 dark:bg-mica-navy-row dark:backdrop-blur-md dark:hover:bg-mica-navy-row-hover"
        >
          <div class="flex flex-1 flex-col truncate pr-4">
            <span class="font-mono text-lg font-bold text-g-primary dark:text-slate-200">
              {{ link.short }}
            </span>
            <span class="truncate font-mono text-sm text-gray-500 dark:text-slate-400">
              {{ link.original }}
            </span>
          </div>
          <div class="w-32 text-center font-mono text-sm text-gray-600 dark:text-slate-400">
            {{ link.clicks ?? 0 }} clicks
          </div>
          <div class="flex w-40 items-center justify-center gap-2">
            <button
              type="button"
              class="min-h-[44px] min-w-[44px] rounded-full p-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-600/30"
              aria-label="Copy link"
              @click="copyToClipboard(link.short)"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              type="button"
              class="min-h-[44px] min-w-[44px] rounded-full p-2.5 text-emerald-500 transition-colors hover:bg-gray-100 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-slate-600/30"
              aria-label="Analytics"
              @click="activeAnalyticsLinkId = link.id; activeAnalyticsShortUrl = link.short; isAnalyticsOpen = true"
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </button>
            <button
              type="button"
              class="min-h-[44px] min-w-[44px] rounded-full p-2.5 text-g-muted transition-colors hover:bg-gray-100 hover:text-g-text dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-600/30"
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
              class="min-h-[44px] min-w-[44px] rounded-full p-2.5 text-red-500 transition-colors hover:bg-gray-100 hover:text-red-700 dark:hover:bg-slate-600/30"
              aria-label="Delete"
              @click="confirmDelete(link)"
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
      </template>
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 px-6 text-center"
      >
        <div class="w-16 h-16 mb-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 relative dark:border-slate-600 dark:text-slate-400">
          <div class="absolute w-2 h-[1px] bg-gray-400"></div>
          <div class="absolute h-2 w-[1px] bg-gray-400"></div>
        </div>
        <h3 class="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2">
          {{ links.length ? 'No matching links' : 'No links yet' }}
        </h3>
        <p v-if="!links.length" class="text-sm text-gray-400 dark:text-slate-500 max-w-md leading-relaxed">
          Create your first short link using the field above.
        </p>
      </div>
    </div>
    </div>

    <!-- Backdrop (separate fade transition) - Teleported to body to elevate above header/footer -->
    <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 bg-black/20 backdrop-blur-sm"
        style="z-index: 99990"
        aria-hidden="true"
        @click="isSidebarOpen = false"
      />
    </Transition>

    <!-- Slide-out Panel (separate slide-right transition) -->
    <Transition name="slide-right">
      <div
        v-if="isSidebarOpen"
        role="dialog"
        aria-labelledby="link-config-title"
        aria-modal="true"
        class="fixed top-0 right-0 flex h-full max-h-screen w-full max-w-md flex-col overflow-y-auto border-l border-gray-200 bg-white p-8 shadow-2xl dark:border-slate-700/50 dark:bg-slate-900"
        style="z-index: 99991"
      >
        <button
          type="button"
          class="absolute right-6 top-6 font-mono text-2xl text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Close"
          @click="isSidebarOpen = false"
        >
          &times;
        </button>

        <h2 id="link-config-title" class="mb-8 text-section-title text-g-primary dark:text-slate-200">
          Link configuration
        </h2>

        <div class="flex flex-1 flex-col">
          <!-- Original Link Input -->
          <input
            v-model="sidebarOriginalUrl"
            type="url"
            placeholder="Original URL"
            class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-g-accent dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />

          <!-- Arrow -->
          <div class="my-4 text-center font-black text-g-text dark:text-slate-300 text-4xl">
            &darr;
          </div>

          <!-- Custom Slug Input (eypi.cc/ prefix + slug) -->
          <div class="mb-6 flex items-center rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus-within:border-g-accent dark:bg-mica-navy-input dark:border-slate-600 dark:focus-within:border-slate-500">
            <span class="shrink-0 font-mono font-bold text-g-primary dark:text-slate-200">eypi.cc/</span>
            <input
              :value="sidebarSlug"
              type="text"
              placeholder="custom-slug"
              class="min-w-0 flex-1 border-0 bg-transparent font-mono outline-none dark:text-slate-200 dark:placeholder-slate-400"
              @input="sanitizeSlugInput"
            />
          </div>

          <!-- Optical Routing Matrix (QR Code Generator) -->
          <div class="mt-8 mb-auto flex flex-col border-t border-gray-200 pt-8">
            <h4 class="text-card-title mb-4 text-gray-400 dark:text-slate-400">
              QR code
            </h4>

            <div class="flex justify-center mb-6">
              <div class="p-2 bg-white border-2 border-gray-200 rounded-xl shadow-sm dark:bg-slate-800/50 dark:border-slate-600" ref="qrContainer"></div>
            </div>

            <div class="mb-6 flex flex-col gap-4 text-sm">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-gray-500 dark:text-slate-400">Body shape</label>
                <select v-model="qrConfig.dotType" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-g-accent dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500">
                  <option value="square">Standard Square</option>
                  <option value="dots">Dotted</option>
                  <option value="rounded">Rounded</option>
                  <option value="classy">Classy</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-gray-500 dark:text-slate-400">Eye frame</label>
                  <select v-model="qrConfig.eyeFrameType" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-g-accent dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500">
                    <option value="square">Square</option>
                    <option value="dot">Dot</option>
                    <option value="extra-rounded">Rounded</option>
                  </select>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium text-gray-500 dark:text-slate-400">Eye ball</label>
                  <select v-model="qrConfig.eyeBallType" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-g-accent dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500">
                    <option value="square">Square</option>
                    <option value="dot">Dot</option>
                  </select>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-gray-500 dark:text-slate-400">Matrix color</label>
                <div class="flex items-center gap-3">
                  <div class="h-10 w-12 rounded-lg border-2 border-gray-200 overflow-hidden shrink-0 focus-within:border-g-accent transition-colors dark:border-slate-600 dark:focus-within:border-slate-500">
                    <input type="color" v-model="qrConfig.color" class="h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer" />
                  </div>
                  <input type="text" v-model="qrConfig.color" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-g-accent font-mono text-sm w-full uppercase transition-colors dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500" placeholder="#DEAC4B" maxlength="7" />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium text-gray-500 dark:text-slate-400">Center logo</label>
                <input type="file" @change="handleLogoUpload" accept="image/*" class="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-g-text hover:file:bg-gray-200 dark:file:bg-slate-700 dark:file:text-slate-200 dark:hover:file:bg-slate-600 transition-colors cursor-pointer" />
              </div>
            </div>

            <button @click="downloadQR" class="w-full flex justify-center items-center gap-2 px-6 py-3 border-2 border-g-primary text-g-primary text-sm font-semibold rounded-lg hover:border-g-accent hover:text-g-accent transition-colors dark:border-slate-400 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100">
              Export PNG
            </button>
          </div>

          <!-- Save Button -->
          <div class="mt-6">
            <button
              type="button"
              class="w-full rounded-xl bg-[#DEAC4B] px-8 py-4 font-semibold text-white transition-all dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
              :disabled="isSaving"
              :class="{ 'opacity-70 cursor-not-allowed animate-pulse': isSaving, 'hover:bg-[#c5963b]': !isSaving }"
              @click="handleSave"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>

  <!-- Delete Confirmation Modal -->
  <Transition name="fade">
    <div
      v-if="isDeleteModalOpen"
      role="dialog"
      aria-labelledby="delete-link-title"
      aria-modal="true"
      class="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      style="z-index: 9999 !important;"
      @click.self="cancelDelete"
    >
      <div
        class="relative z-50 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:bg-mica-navy-modal dark:border-slate-600 dark:backdrop-blur-xl"
      >
        <div class="h-2 w-full shrink-0 bg-red-500" />
        <div class="flex flex-col p-8">
          <h3 id="delete-link-title" class="text-section-title mb-2 text-red-500">
            Confirm deletion
          </h3>
          <p class="mb-8 text-sm leading-relaxed text-gray-800 dark:text-slate-200">
            Are you sure you want to delete the short link
            <span class="font-bold text-g-text dark:text-slate-100">{{ linkToDelete?.short }}</span>?
            This will permanently break the redirect to
            <span class="break-all text-gray-500 dark:text-slate-400">{{ linkToDelete?.original }}</span>
            and cannot be undone.
          </p>
          <div class="flex w-full justify-end gap-4">
            <button
              type="button"
              class="rounded-lg px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-black dark:bg-slate-700/50 dark:text-slate-200 dark:hover:bg-slate-600"
              @click="cancelDelete"
            >
              Abort
            </button>
            <button
              type="button"
              class="rounded-lg bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-600"
              @click="executeDelete"
            >
              Delete Link
            </button>
          </div>
        </div>
      </div>
    </div>
    </Transition>
  </div>

  <AnalyticsPanel
    :link-id="activeAnalyticsLinkId"
    :is-open="isAnalyticsOpen"
    :short-url="activeAnalyticsShortUrl"
    @close="isAnalyticsOpen = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QRCodeStyling from 'qr-code-styling'
import { useToast } from '@/composables/useToast'
import AnalyticsPanel from '@/components/AnalyticsPanel.vue'
import { API_BASE_URL } from '@/config/api'
import { isReservedSlug } from '@shared/reservedSlugs'

const toast = useToast()
const router = useRouter()
const route = useRoute()

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
const isValidSlug = (slug: string) => /^[a-zA-Z0-9]+$/.test(slug)

const copyToClipboard = async (text: string) => {
  try {
    const url = text.startsWith('http') ? text : `https://${text}`
    await navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Failed to copy link')
  }
}

interface Link {
  id: string
  original: string
  short: string
  clicks?: number
}

const longUrlInput = ref('')
const isSidebarOpen = ref(false)
const isDeleteModalOpen = ref(false)
const activeAnalyticsLinkId = ref<string | number | null>(null)
const activeAnalyticsShortUrl = ref('')
const isAnalyticsOpen = ref(false)
const linkToDelete = ref<Link | null>(null)
const activeLink = ref<Link | null>(null)
const sidebarOriginalUrl = ref('')
const sidebarSlug = ref('')
const isShortening = ref(false)
const isSaving = ref(false)

const qrContainer = ref<HTMLElement | null>(null)
const qrConfig = ref({
  dotType: 'square' as 'square' | 'dots' | 'rounded' | 'classy' | 'classy-rounded' | 'extra-rounded',
  eyeFrameType: 'square' as 'square' | 'dot' | 'extra-rounded',
  eyeBallType: 'square' as 'square' | 'dot',
  logoUrl: '' as string,
  color: '#DEAC4B'
})
const liveShortUrl = computed(() => 'https://eypi.cc/' + (sidebarSlug.value.trim() || 'preview'))

const qrEngine = new QRCodeStyling({
  width: 240,
  height: 240,
  type: 'canvas',
  imageOptions: { crossOrigin: 'anonymous', margin: 8 }
})

const updateQR = () => {
  qrEngine.update({
    data: liveShortUrl.value,
    image: qrConfig.value.logoUrl,
    backgroundOptions: { color: 'transparent' },
    dotsOptions: { color: qrConfig.value.color, type: qrConfig.value.dotType },
    cornersSquareOptions: { color: qrConfig.value.color, type: qrConfig.value.eyeFrameType },
    cornersDotOptions: { color: qrConfig.value.color, type: qrConfig.value.eyeBallType }
  })
}

watch(liveShortUrl, updateQR)
watch(qrConfig, updateQR, { deep: true })
watch(isSidebarOpen, async (open) => {
  if (open) {
    await nextTick()
    if (qrContainer.value) {
      qrEngine.append(qrContainer.value)
    }
    updateQR()
  }
})

const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const LOGO_MAX_BYTES = 2 * 1024 * 1024

const handleLogoUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    toast.error('Logo must be PNG, JPEG, WebP, or GIF.')
    return
  }
  if (file.size > LOGO_MAX_BYTES) {
    toast.error('Logo must be smaller than 2 MB.')
    return
  }
  if (qrConfig.value.logoUrl) {
    URL.revokeObjectURL(qrConfig.value.logoUrl)
  }
  qrConfig.value.logoUrl = URL.createObjectURL(file)
}

const downloadQR = async () => {
  qrEngine.update({ width: 1920, height: 1920 })
  await qrEngine.download({ name: `eypi-qr-${sidebarSlug.value || 'link'}`, extension: 'png' })
  qrEngine.update({ width: 240, height: 240 })
  toast.success('QR code exported')
}

const links = ref<Link[]>([])
const searchQuery = ref('')
const filteredLinks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return links.value
  return links.value.filter((link) =>
    link.short.toLowerCase().includes(q) ||
    link.original.toLowerCase().includes(q)
  )
})

async function fetchLinks() {
  const token = localStorage.getItem('eypi_token')
  if (!token) {
    router.push('/login')
    return
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/links`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    if (response.status === 401) {
      localStorage.removeItem('eypi_token')
      router.push('/login')
      return
    }
    const data = await response.json()
    links.value = data.links || []
  } catch (error) {
    console.error('Fetch error:', error)
  }
}

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

function sanitizeSlugInput(e: Event) {
  const target = e.target as HTMLInputElement
  sidebarSlug.value = target.value.replace(/[^a-zA-Z0-9]/g, '')
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

async function handleShorten() {
  const urlToProcess = normalizeUrl(longUrlInput.value)
  if (!urlToProcess) return

  if (!isValidUrl(urlToProcess)) {
    toast.error('Enter a valid URL.')
    return
  }

  const token = localStorage.getItem('eypi_token')
  if (!token) {
    toast.error('Please log in to create links')
    return
  }

  isShortening.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ original_url: urlToProcess }),
    })
    const data = await res.json()

    if (res.status === 401) {
      toast.error('Session expired. Please log in again.')
      return
    }

    if (!res.ok) {
      toast.error(data.error || 'Failed to create link')
      return
    }

    if (data.status === 'success' && data.link) {
      longUrlInput.value = ''
      toast.success('Link created')
      await fetchLinks()
      const newLink = links.value.find((l) => l.original === urlToProcess || normalizeUrl(l.original) === urlToProcess)
      if (newLink) {
        openSidebar(newLink)
      }
    }
  } catch {
    toast.error('Failed to create link')
  } finally {
    isShortening.value = false
  }
}

async function onSave(): Promise<void> {
  if (!activeLink.value) {
    isSidebarOpen.value = false
    return
  }
  const slug = sidebarSlug.value.trim()
    ? sidebarSlug.value.trim()
    : hashToSlug(sidebarOriginalUrl.value)
  const originalUrl = sidebarOriginalUrl.value.trim()
  const token = localStorage.getItem('eypi_token')
  if (!token) {
    toast.error('Please log in to update links')
    return
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/links/${activeLink.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ original_url: originalUrl, slug }),
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      toast.success('Link updated')
      isSidebarOpen.value = false
      await fetchLinks()
    } else {
      toast.error(data.error || 'Failed to update link')
    }
  } catch {
    toast.error('Failed to update link')
  }
}

async function handleSave() {
  const url = sidebarOriginalUrl.value.trim()
  const slug = sidebarSlug.value.trim()

  if (!isValidUrl(url)) {
    toast.error('Cannot save: Invalid destination URL')
    return
  }

  if (slug && !isValidSlug(slug)) {
    toast.error('Slug must contain only letters and numbers')
    return
  }

  if (slug && isReservedSlug(slug)) {
    toast.error('That slug is reserved. Choose another.')
    return
  }

  isSaving.value = true
  try {
    await onSave()
  } finally {
    isSaving.value = false
  }
}

function confirmDelete(link: Link): void {
  linkToDelete.value = link
  isDeleteModalOpen.value = true
}

function cancelDelete(): void {
  isDeleteModalOpen.value = false
  linkToDelete.value = null
}

async function executeDelete(): Promise<void> {
  if (!linkToDelete.value) return
  const linkId = linkToDelete.value.id
  const token = localStorage.getItem('eypi_token')
  if (!token) {
    toast.error('Please log in to delete links')
    cancelDelete()
    return
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/links/${linkId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      links.value = links.value.filter((l) => l.id !== linkId)
      toast.success('Link deleted')
      cancelDelete()
    } else {
      toast.error(data.error || 'Failed to delete link')
    }
  } catch {
    toast.error('Failed to delete link')
  }
}

onMounted(async () => {
  await fetchLinks()

  // Check for pending URL from Landing Page
  const routeUrl = route.query.url as string
  const savedUrl = localStorage.getItem('pending_url')
  const rawUrl = routeUrl || savedUrl || ''
  const urlToShorten = normalizeUrl(rawUrl)

  if (urlToShorten && isValidUrl(urlToShorten)) {
    longUrlInput.value = urlToShorten
    localStorage.removeItem('pending_url')
    await handleShorten()
    router.replace({ path: '/links', query: {} })
  }
})
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




