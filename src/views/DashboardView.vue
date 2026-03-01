<template>
  <div class="relative w-full">
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
        class="rounded-xl bg-[#DEAC4B] px-8 py-4 font-bold uppercase tracking-wider text-white transition-all"
        :disabled="isShortening"
        :class="{ 'opacity-70 cursor-not-allowed animate-pulse': isShortening, 'hover:scale-105': !isShortening }"
        @click="handleShorten"
      >
        {{ isShortening ? 'PROCESSING...' : 'SHORTEN' }}
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
      <template v-if="links.length > 0">
        <div
          v-for="link in links"
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
        <div class="w-16 h-16 mb-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 relative">
          <div class="absolute w-2 h-[1px] bg-gray-400"></div>
          <div class="absolute h-2 w-[1px] bg-gray-400"></div>
        </div>
        <h3 class="font-mono text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">
          NO ACTIVE TRANSMISSIONS
        </h3>
        <p class="font-mono text-sm text-gray-400 max-w-md leading-relaxed">
          The registry is currently empty. Enter a destination URL in the console above to establish a new routing sequence.
        </p>
      </div>
    </div>

    <!-- Backdrop (separate fade transition) -->
    <Transition name="fade">
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 bg-black/20 backdrop-blur-sm"
        style="z-index: 9990 !important;"
        aria-hidden="true"
        @click="isSidebarOpen = false"
      />
    </Transition>

    <!-- Slide-out Panel (separate slide-right transition) -->
    <Transition name="slide-right">
      <div
        v-if="isSidebarOpen"
        class="mica-card fixed top-0 right-0 flex h-full max-h-screen w-full max-w-md flex-col overflow-y-auto border-l border-gray-300 p-8 shadow-2xl"
        style="z-index: 9991 !important;"
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
              :value="sidebarSlug"
              type="text"
              placeholder="custom-slug"
              class="min-w-0 flex-1 border-0 bg-transparent font-mono outline-none"
              @input="sanitizeSlugInput"
            />
          </div>

          <!-- Optical Routing Matrix (QR Code Generator) -->
          <div class="mt-8 mb-auto flex flex-col border-t border-gray-200 pt-8">
            <h4 class="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
              Optical Routing Matrix
            </h4>

            <div class="flex justify-center mb-6">
              <div class="p-2 bg-white border-2 border-gray-200 rounded-xl shadow-sm" ref="qrContainer"></div>
            </div>

            <div class="flex flex-col gap-4 mb-6 font-mono text-sm">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Body Shape</label>
                <select v-model="qrConfig.dotType" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-[#34418F]">
                  <option value="square">Standard Square</option>
                  <option value="dots">Dotted</option>
                  <option value="rounded">Rounded</option>
                  <option value="classy">Classy</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Eye Frame</label>
                  <select v-model="qrConfig.eyeFrameType" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-[#34418F]">
                    <option value="square">Square</option>
                    <option value="dot">Dot</option>
                    <option value="extra-rounded">Rounded</option>
                  </select>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Eye Ball</label>
                  <select v-model="qrConfig.eyeBallType" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-[#34418F]">
                    <option value="square">Square</option>
                    <option value="dot">Dot</option>
                  </select>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Matrix Color</label>
                <div class="flex items-center gap-3">
                  <div class="h-10 w-12 rounded-lg border-2 border-gray-200 overflow-hidden shrink-0 focus-within:border-[#34418F] transition-colors">
                    <input type="color" v-model="qrConfig.color" class="h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer" />
                  </div>
                  <input type="text" v-model="qrConfig.color" class="bg-white border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-[#34418F] font-mono text-sm w-full uppercase transition-colors" placeholder="#34418F" maxlength="7" />
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-xs text-gray-500 font-bold uppercase tracking-wider">Center Logo</label>
                <input type="file" @change="handleLogoUpload" accept="image/*" class="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-[#34418F] hover:file:bg-gray-200 transition-colors cursor-pointer" />
              </div>
            </div>

            <button @click="downloadQR" class="w-full flex justify-center items-center gap-2 px-6 py-3 border-2 border-[#34418F] text-[#34418F] font-mono text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-[#34418F] hover:text-white transition-colors">
              Export PNG
            </button>
          </div>

          <!-- Save Button -->
          <button
            type="button"
            class="mt-auto w-full rounded-xl bg-[#DEAC4B] px-8 py-4 font-bold uppercase tracking-wider text-white transition-all"
            :disabled="isSaving"
            :class="{ 'opacity-70 cursor-not-allowed animate-pulse': isSaving, 'hover:bg-[#c5963b]': !isSaving }"
            @click="handleSave"
          >
            {{ isSaving ? 'ENCRYPTING...' : 'SAVE' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Delete Confirmation Modal -->
  <Transition name="fade">
    <div
      v-if="isDeleteModalOpen"
      class="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      style="z-index: 9999 !important;"
      @click.self="cancelDelete"
    >
      <div
        class="relative z-50 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div class="h-2 w-full shrink-0 bg-red-500" />
        <div class="flex flex-col p-8">
          <h3 class="mb-2 font-mono text-xl font-black uppercase tracking-widest text-red-500">
            CONFIRM DELETION
          </h3>
          <p class="mb-8 font-mono text-sm leading-relaxed text-gray-800">
            Are you sure you want to delete the short link
            <span class="font-bold text-[#34418F]">{{ linkToDelete?.short }}</span>?
            This will permanently break the redirect to
            <span class="break-all text-gray-500">{{ linkToDelete?.original }}</span>
            and cannot be undone.
          </p>
          <div class="flex w-full justify-end gap-4">
            <button
              type="button"
              class="rounded-lg px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-100 hover:text-black"
              @click="cancelDelete"
            >
              Abort
            </button>
            <button
              type="button"
              class="rounded-lg bg-red-500 px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-md transition-colors hover:bg-red-600"
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
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QRCodeStyling from 'qr-code-styling'
import { useToast } from '@/composables/useToast'

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

interface Link {
  id: string
  original: string
  short: string
  clicks?: number
}

const longUrlInput = ref('')
const isSidebarOpen = ref(false)
const isDeleteModalOpen = ref(false)
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
  color: '#34418F'
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

const handleLogoUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    if (qrConfig.value.logoUrl) {
      URL.revokeObjectURL(qrConfig.value.logoUrl)
    }
    qrConfig.value.logoUrl = URL.createObjectURL(file)
  }
}

const downloadQR = async () => {
  qrEngine.update({ width: 1920, height: 1920 })
  await qrEngine.download({ name: `eypi-qr-${sidebarSlug.value || 'link'}`, extension: 'png' })
  qrEngine.update({ width: 240, height: 240 })
  toast.success('High-Res QR Code exported successfully')
}

const API_BASE = 'https://api.eypi.cc'
const links = ref<Link[]>([])

async function fetchLinks() {
  const token = localStorage.getItem('eypi_token')
  if (!token) {
    router.push('/login')
    return
  }
  try {
    const response = await fetch(`${API_BASE}/api/links`, {
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
    toast.error('Transmission failed: Invalid URL format')
    return
  }

  const token = localStorage.getItem('eypi_token')
  if (!token) {
    toast.error('Please log in to create links')
    return
  }

  isShortening.value = true
  try {
    const res = await fetch(`${API_BASE}/api/links`, {
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
      toast.success('New link successfully generated')
      await fetchLinks()
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
    const res = await fetch(`${API_BASE}/api/links/${activeLink.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ original_url: originalUrl, slug }),
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      toast.success('Link successfully updated')
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
    const res = await fetch(`${API_BASE}/api/links/${linkId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok && data.status === 'success') {
      links.value = links.value.filter((l) => l.id !== linkId)
      toast.success('Link successfully deleted')
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
    router.replace({ path: '/dashboard', query: {} })
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
