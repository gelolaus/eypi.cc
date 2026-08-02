<template>
  <div class="relative w-full">
    <div
      class="mx-auto flex w-full max-w-5xl flex-col px-4 pt-8 pb-24 md:pt-16 md:pb-32"
    >
      <header class="mb-8">
        <h1 class="font-display text-3xl font-bold text-g-text">
          Links
        </h1>
        <p class="mt-2 text-g-muted">
          Shorten URLs and track click analytics by OS, country, and referrer.
        </p>
      </header>

      <Card className="mb-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-start">
          <div class="min-w-0 flex-1">
            <Input
              :value="longUrlInput"
              type="url"
              placeholder="Paste your long link here..."
              className="font-mono"
              :aria-invalid="Boolean(longUrlError)"
              :aria-describedby="longUrlError ? 'long-url-error' : undefined"
              @input="onLongUrlInput"
            />
            <p v-if="longUrlError" id="long-url-error" class="mt-1 text-sm text-g-destructive">{{ longUrlError }}</p>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full shrink-0 md:w-auto"
            :disabled="isShortening"
            @click="handleShorten"
          >
            {{ isShortening ? 'Processing...' : 'Shorten' }}
          </Button>
        </div>
      </Card>

      <Input
        :value="searchQuery"
        type="search"
        placeholder="Search links..."
        className="mb-6"
        @input="onSearchInput"
      />

      <div class="w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <Card className="!p-0 w-full min-w-[600px] overflow-hidden md:!p-0">
          <div
            class="flex items-center justify-between border-b border-g-border bg-g-bg px-4 py-3 text-xs font-semibold text-g-muted md:px-6"
          >
            <span class="flex-1">Short link</span>
            <span class="w-32 text-center">Clicks</span>
            <span class="w-40 text-center">Actions</span>
          </div>

          <template v-if="filteredLinks.length > 0">
            <div
              v-for="link in filteredLinks"
              :key="link.id"
              class="flex items-center justify-between border-b border-g-border px-4 py-5 transition-colors last:border-0 hover:bg-g-bg md:px-6"
            >
              <div class="flex flex-1 flex-col truncate pr-4">
                <span class="font-mono text-lg font-bold text-g-text">
                  {{ link.short }}
                </span>
                <span class="truncate font-mono text-sm text-g-muted">
                  {{ link.original }}
                </span>
              </div>
              <div class="w-32 text-center font-mono text-sm text-g-muted">
                {{ link.clicks ?? 0 }} clicks
              </div>
              <div class="flex w-40 items-center justify-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!min-h-[44px] !min-w-[44px] !rounded-full !px-0"
                  aria-label="Copy link"
                  @click="copyToClipboard(link.short)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!min-h-[44px] !min-w-[44px] !rounded-full !px-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  aria-label="Analytics"
                  @click="activeAnalyticsLinkId = link.id; activeAnalyticsShortUrl = link.short; isAnalyticsOpen = true"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!min-h-[44px] !min-w-[44px] !rounded-full !px-0"
                  aria-label="Edit"
                  @click="openSidebar(link)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!min-h-[44px] !min-w-[44px] !rounded-full !px-0 text-g-destructive hover:text-g-destructive"
                  aria-label="Delete"
                  @click="confirmDelete(link)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </template>
          <EmptyState
            v-else
            :title="links.length ? 'No matching links' : 'No links yet'"
            :description="links.length ? undefined : 'Create your first short link using the field above.'"
            className="py-20"
          />
        </Card>
      </div>

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

        <Transition name="slide-right">
          <div
            v-if="isSidebarOpen"
            role="dialog"
            aria-labelledby="link-config-title"
            aria-modal="true"
            class="fixed top-0 right-0 flex h-full max-h-screen w-full max-w-md flex-col overflow-y-auto border-l border-g-border bg-g-surface p-8 shadow-2xl"
            style="z-index: 99991"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 !min-h-[44px] !min-w-[44px] !rounded-full !px-0 text-2xl leading-none"
              aria-label="Close"
              @click="isSidebarOpen = false"
            >
              &times;
            </Button>

            <h2 id="link-config-title" class="mb-8 font-display text-2xl font-semibold text-g-text">
              Link configuration
            </h2>

            <div class="flex flex-1 flex-col">
              <div class="mb-4">
                <Input
                  :value="sidebarOriginalUrl"
                  type="url"
                  placeholder="Original URL"
                  :aria-invalid="Boolean(sidebarUrlError)"
                  :aria-describedby="sidebarUrlError ? 'sidebar-url-error' : undefined"
                  @input="onSidebarUrlInput"
                />
                <p v-if="sidebarUrlError" id="sidebar-url-error" class="mt-1 text-sm text-g-destructive">{{ sidebarUrlError }}</p>
              </div>

              <div class="my-4 text-center text-4xl font-black text-g-text">
                &darr;
              </div>

              <div class="mb-6">
                <div
                  class="flex h-11 items-center rounded-xl border border-g-border bg-g-surface px-4 focus-within:ring-2 focus-within:ring-[var(--color-ring)]"
                >
                  <span class="shrink-0 font-mono font-bold text-g-text">eypi.cc/</span>
                  <input
                    :value="sidebarSlug"
                    type="text"
                    placeholder="custom-slug"
                    class="min-w-0 flex-1 border-0 bg-transparent font-mono text-g-text outline-none placeholder:text-g-muted"
                    :aria-invalid="Boolean(slugError)"
                    :aria-describedby="slugError ? 'slug-error' : undefined"
                    @input="sanitizeSlugInput"
                  />
                </div>
                <p v-if="slugError" id="slug-error" class="mt-1 text-sm text-g-destructive">{{ slugError }}</p>
              </div>

              <div class="mb-auto mt-8 flex flex-col border-t border-g-border pt-8">
                <h4 class="mb-4 font-display text-lg font-semibold text-g-muted">
                  QR code
                </h4>

                <div class="mb-6 flex justify-center">
                  <div class="rounded-xl border border-g-border bg-white p-2 shadow-sm" ref="qrContainer"></div>
                </div>

                <div class="mb-6 flex flex-col gap-4 text-sm">
                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-g-muted">Body shape</label>
                    <Select :value="qrConfig.dotType" @change="onDotTypeChange">
                      <option value="square">Standard Square</option>
                      <option value="dots">Dotted</option>
                      <option value="rounded">Rounded</option>
                      <option value="classy">Classy</option>
                    </Select>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium text-g-muted">Eye frame</label>
                      <Select :value="qrConfig.eyeFrameType" @change="onEyeFrameChange">
                        <option value="square">Square</option>
                        <option value="dot">Dot</option>
                        <option value="extra-rounded">Rounded</option>
                      </Select>
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium text-g-muted">Eye ball</label>
                      <Select :value="qrConfig.eyeBallType" @change="onEyeBallChange">
                        <option value="square">Square</option>
                        <option value="dot">Dot</option>
                      </Select>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-g-muted">Matrix color</label>
                    <div class="flex items-center gap-3">
                      <div class="h-11 w-12 shrink-0 overflow-hidden rounded-xl border border-g-border focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
                        <input type="color" v-model="qrConfig.color" class="h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer" />
                      </div>
                      <Input
                        :value="qrConfig.color"
                        type="text"
                        className="font-mono uppercase"
                        placeholder="#DEAC4B"
                        maxlength="7"
                        @input="onQrColorInput"
                      />
                    </div>
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-g-muted">Center logo</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      class="cursor-pointer text-xs file:mr-4 file:rounded-full file:border-0 file:bg-g-bg file:px-4 file:py-2 file:text-xs file:font-bold file:text-g-text hover:file:bg-g-border"
                      :aria-invalid="Boolean(logoError)"
                      :aria-describedby="logoError ? 'logo-error' : logoPersistHint ? 'logo-persist-hint' : undefined"
                      @change="handleLogoUpload"
                    />
                    <Button
                      v-if="qrConfig.logoDataUrl"
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start !px-0 underline-offset-2 hover:underline"
                      @click="clearLogo"
                    >
                      Remove logo
                    </Button>
                    <p v-if="logoError" id="logo-error" class="text-sm text-g-destructive">{{ logoError }}</p>
                    <p v-else-if="logoPersistHint" id="logo-persist-hint" class="text-sm text-amber-600 dark:text-amber-400">{{ logoPersistHint }}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  :disabled="isExporting || isQrRendering"
                  @click="downloadQR"
                >
                  {{ isExporting ? 'Exporting…' : 'Export PNG' }}
                </Button>
              </div>

              <div class="mt-6">
                <Button
                  type="button"
                  className="w-full"
                  :disabled="isSaving"
                  @click="handleSave"
                >
                  {{ isSaving ? 'Saving...' : 'Save' }}
                </Button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
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
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import AnalyticsPanel from '@/components/AnalyticsPanel.vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Select from '@/components/ui/Select.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { API_BASE_URL } from '@/config/api'
import { isReservedSlug } from '@shared/reservedSlugs'
import {
  DEFAULT_LINK_QR_CONFIG,
  QR_LOGO_PREVIEW_MAX_BYTES,
  logoExceedsSaveLimit,
  parseLinkQrConfig,
  type LinkQrConfig,
} from '@shared/linkQrConfig'
import { normalizeQrLogoDataUrl } from '@/utils/normalizeQrLogo'
import { downloadLinkQrPng, renderLinkQrCanvas } from '@/utils/renderLinkQr'

const toast = useToast()
const dialog = useDialog()
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
  qrConfig?: LinkQrConfig
}

const longUrlInput = ref('')
const isSidebarOpen = ref(false)
const activeAnalyticsLinkId = ref<string | number | null>(null)
const activeAnalyticsShortUrl = ref('')
const isAnalyticsOpen = ref(false)
const activeLink = ref<Link | null>(null)
const sidebarOriginalUrl = ref('')
const sidebarSlug = ref('')
const isShortening = ref(false)
const isSaving = ref(false)
const longUrlError = ref('')
const sidebarUrlError = ref('')
const slugError = ref('')
const logoError = ref('')
const logoPersistHint = ref('')

function onLongUrlInput(e: Event) {
  longUrlInput.value = (e.target as HTMLInputElement).value
}
function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
}
function onSidebarUrlInput(e: Event) {
  sidebarOriginalUrl.value = (e.target as HTMLInputElement).value
}
function onQrColorInput(e: Event) {
  qrConfig.value.color = (e.target as HTMLInputElement).value
}
function onDotTypeChange(e: Event) {
  qrConfig.value.dotType = (e.target as HTMLSelectElement).value as LinkQrConfig['dotType']
}
function onEyeFrameChange(e: Event) {
  qrConfig.value.eyeFrameType = (e.target as HTMLSelectElement).value as LinkQrConfig['eyeFrameType']
}
function onEyeBallChange(e: Event) {
  qrConfig.value.eyeBallType = (e.target as HTMLSelectElement).value as LinkQrConfig['eyeBallType']
}

watch(longUrlInput, () => { longUrlError.value = '' })
watch(sidebarOriginalUrl, () => { sidebarUrlError.value = '' })
watch(sidebarSlug, () => { slugError.value = '' })

const qrContainer = ref<HTMLElement | null>(null)
const qrConfig = ref<LinkQrConfig>({ ...DEFAULT_LINK_QR_CONFIG })
const liveShortUrl = computed(() => 'https://eypi.cc/' + (sidebarSlug.value.trim() || 'preview'))
const isQrRendering = ref(false)
const isExporting = ref(false)
let qrRenderGeneration = 0

async function updateQR() {
  if (!isSidebarOpen.value || !qrContainer.value) return
  const generation = ++qrRenderGeneration
  const container = qrContainer.value
  const config = { ...qrConfig.value }
  const data = liveShortUrl.value
  isQrRendering.value = true
  try {
    const canvas = await renderLinkQrCanvas(240, data, config, 'white')
    if (generation !== qrRenderGeneration || !qrContainer.value) return
    container.replaceChildren(canvas)
  } catch (err) {
    console.error('QR preview update failed', err)
    if (generation === qrRenderGeneration) {
      container.replaceChildren()
      toast.error('Could not render QR preview')
    }
  } finally {
    if (generation === qrRenderGeneration) isQrRendering.value = false
  }
}

watch(liveShortUrl, () => { void updateQR() })
watch(qrConfig, () => { void updateQR() }, { deep: true })
watch(isSidebarOpen, async (open) => {
  if (open) {
    await nextTick()
    await updateQR()
  }
})

const LOGO_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function refreshLogoPersistHint() {
  logoPersistHint.value = logoExceedsSaveLimit(qrConfig.value.logoDataUrl)
    ? 'This logo is larger than 2 MB. Preview and Export will include it, but Save will keep your QR styles without the logo. Use a file under 2 MB to persist the logo.'
    : ''
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read image.'))
    }
    reader.onerror = () => reject(new Error('Failed to read image.'))
    reader.readAsDataURL(file)
  })
}

const handleLogoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  logoError.value = ''
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    logoError.value = 'Choose a PNG, JPEG, WebP, or GIF image.'
    input.value = ''
    return
  }
  if (file.size > QR_LOGO_PREVIEW_MAX_BYTES) {
    logoError.value = 'Choose an image smaller than 10 MB for preview.'
    input.value = ''
    return
  }
  try {
    const raw = await readFileAsDataUrl(file)
    qrConfig.value.logoDataUrl = await normalizeQrLogoDataUrl(raw)
    refreshLogoPersistHint()
    if (logoPersistHint.value) {
      toast.info('Logo won’t be saved at this size', {
        detail: 'Export still includes it. Save will keep styles only unless you use a file under 2 MB.',
        duration: 9000,
      })
    }
  } catch {
    logoError.value = 'Failed to read that image.'
    input.value = ''
  }
}

function clearLogo() {
  qrConfig.value.logoDataUrl = null
  logoError.value = ''
  logoPersistHint.value = ''
}

const downloadQR = async () => {
  if (isExporting.value) return
  isExporting.value = true
  try {
    let config = { ...qrConfig.value }
    if (config.logoDataUrl) {
      config.logoDataUrl = await normalizeQrLogoDataUrl(config.logoDataUrl)
    }
    await downloadLinkQrPng(
      1920,
      liveShortUrl.value,
      config,
      `eypi-qr-${sidebarSlug.value || 'link'}`,
      'transparent',
    )
    toast.success('QR code exported')
  } catch (err) {
    console.error('QR export failed', err)
    toast.error('Failed to export QR code')
  } finally {
    isExporting.value = false
  }
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
    const data = await response.json() as { links?: Link[] }
    links.value = (data.links || []).map((link) => ({
      ...link,
      qrConfig: parseLinkQrConfig(link.qrConfig ?? null),
    }))
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

async function applyQrConfig(config: LinkQrConfig) {
  const next = parseLinkQrConfig(config)
  if (next.logoDataUrl) {
    try {
      next.logoDataUrl = await normalizeQrLogoDataUrl(next.logoDataUrl)
    } catch {
      next.logoDataUrl = null
      logoError.value = 'Saved logo could not be loaded. Upload it again.'
    }
  }
  qrConfig.value = next
  refreshLogoPersistHint()
}

async function openSidebar(link?: Link): Promise<void> {
  activeLink.value = link ?? null
  logoError.value = ''
  if (link) {
    sidebarOriginalUrl.value = link.original
    sidebarSlug.value = extractSlug(link.short)
    await applyQrConfig(link.qrConfig ?? DEFAULT_LINK_QR_CONFIG)
  } else {
    sidebarOriginalUrl.value = longUrlInput.value
    sidebarSlug.value = hashToSlug(longUrlInput.value)
    qrConfig.value = { ...DEFAULT_LINK_QR_CONFIG }
    refreshLogoPersistHint()
  }
  isSidebarOpen.value = true
}

async function handleShorten() {
  const urlToProcess = normalizeUrl(longUrlInput.value)
  if (!urlToProcess) {
    longUrlError.value = 'Enter the URL you want to shorten.'
    return
  }

  if (!isValidUrl(urlToProcess)) {
    longUrlError.value = 'Enter a valid URL.'
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
      body: JSON.stringify({
        original_url: originalUrl,
        slug,
        qr_config: qrConfig.value,
      }),
    })
    const data = await res.json() as {
      status?: string
      error?: string
      logoOmitted?: boolean
      qrConfig?: LinkQrConfig
    }
    if (res.ok && data.status === 'success') {
      if (data.logoOmitted) {
        toast.info('Saved without logo', {
          detail: 'QR styles were saved, but the logo was over 2 MB so it was not stored. Re-attach a smaller logo next time if you want it saved.',
          duration: 10000,
        })
      } else {
        toast.success('Link updated')
      }
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
    sidebarUrlError.value = 'Enter a valid destination URL.'
    return
  }

  if (slug && !isValidSlug(slug)) {
    slugError.value = 'Use letters and numbers only.'
    return
  }

  if (slug && isReservedSlug(slug)) {
    slugError.value = 'Choose a different slug. This one is reserved.'
    return
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(qrConfig.value.color.trim())) {
    toast.error('Matrix color must be a hex value like #DEAC4B.')
    return
  }

  isSaving.value = true
  try {
    await onSave()
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete(link: Link): Promise<void> {
  const ok = await dialog.confirm({
    title: 'Delete this link?',
    body: `Removes "${link.short}" and breaks its redirect to ${link.original}. This cannot be undone.`,
    confirmLabel: 'Delete link',
  })
  if (!ok) return
  await executeDelete(link)
}

async function executeDelete(link: Link): Promise<void> {
  const linkId = link.id
  const token = localStorage.getItem('eypi_token')
  if (!token) {
    toast.error('Log in to delete this link.')
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
