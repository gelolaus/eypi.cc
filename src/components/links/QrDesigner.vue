<template>
  <section class="mt-8 border-t border-border pt-8">
    <h3 class="mb-4 text-base font-semibold text-muted-foreground">
      QR code
    </h3>
    <div class="mb-6 flex justify-center">
      <!-- QR codes must stay dark on light to scan, so the preview is white in every theme. -->
      <div
        ref="preview"
        data-qr-preview
        class="rounded-xl border border-border bg-white p-2"
      />
    </div>
    <div class="mb-4 flex min-h-11 items-center gap-3">
      <Switch
        id="qr-track-scans"
        :model-value="trackScans"
        @update:model-value="emit('update:trackScans', $event === true)"
      />
      <Label for="qr-track-scans">
        Track QR scans
      </Label>
    </div>
    <div class="mb-6 flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="qr-body-shape">Body shape</Label>
        <select
          id="qr-body-shape"
          class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
          :value="config.dotType"
          @change="onDot"
        >
          <option value="square">
            Square
          </option>
          <option value="dots">
            Dotted
          </option>
          <option value="rounded">
            Rounded
          </option>
          <option value="classy">
            Classy
          </option>
          <option value="classy-rounded">
            Classy rounded
          </option>
          <option value="extra-rounded">
            Extra rounded
          </option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <Label for="qr-eye-frame">Eye frame</Label>
          <select
            id="qr-eye-frame"
            class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
            :value="config.eyeFrameType"
            @change="onFrame"
          >
            <option value="square">
              Square
            </option>
            <option value="dot">
              Dot
            </option>
            <option value="extra-rounded">
              Rounded
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="qr-eye-ball">Eye ball</Label>
          <select
            id="qr-eye-ball"
            class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
            :value="config.eyeBallType"
            @change="onBall"
          >
            <option value="square">
              Square
            </option>
            <option value="dot">
              Dot
            </option>
          </select>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="qr-matrix-color">
          Matrix color
        </Label>
        <Input
          id="qr-matrix-color"
          class="font-mono uppercase"
          maxlength="7"
          type="text"
          :model-value="config.color"
          @input="onColor"
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="qr-center-logo">
          Center logo
        </Label>
        <input
          id="qr-center-logo"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="min-h-11 w-full min-w-0 text-sm text-muted-foreground file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground"
          type="file"
          :aria-describedby="logoError ? 'logo-error' : logoHint ? 'logo-persist-hint' : undefined"
          :aria-invalid="Boolean(logoError)"
          @change="onLogo"
        >
        <Button
          v-if="config.logoDataUrl"
          class="self-start"
          size="sm"
          variant="ghost"
          type="button"
          @click="removeLogo"
        >
          Remove logo
        </Button>
        <p
          v-if="logoError"
          id="logo-error"
          class="text-base text-destructive"
          role="alert"
        >
          {{ logoError }}
        </p>
        <p
          v-else-if="logoHint"
          id="logo-persist-hint"
          class="text-base text-muted-foreground"
        >
          This logo is larger than 10 MB. Preview and export include it, but save keeps the style without the logo.
        </p>
      </div>
    </div>
    <Button
      class="w-full"
      variant="outline"
      type="button"
      :disabled="exporting"
      @click="download"
    >
      {{ exporting ? 'Exporting…' : 'Export PNG' }}
    </Button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  QR_LOGO_PREVIEW_MAX_BYTES,
  logoExceedsSaveLimit,
  type LinkQrConfig,
  type LinkQrDotType,
  type LinkQrEyeBallType,
  type LinkQrEyeFrameType,
} from '@shared/linkQrConfig'
import { ApiError, api } from '@/lib/api'
import { normalizeQrLogoDataUrl } from '@/utils/normalizeQrLogo'
import { downloadLinkQrPng, renderLinkQrCanvas } from '@/utils/renderLinkQr'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  slug: string
  config: LinkQrConfig
  trackScans: boolean
  linkId?: string | null
}>()

const emit = defineEmits<{
  'update:config': [config: LinkQrConfig]
  'update:trackScans': [value: boolean]
  uploading: [busy: boolean]
}>()

const toast = useToast()
const preview = ref<HTMLElement | null>(null)
const logoError = ref('')
const exporting = ref(false)
const logoHint = computed(() => logoExceedsSaveLimit(props.config.logoDataUrl))
const dataUrl = computed(() => {
  const slug = props.slug.trim() || 'preview'
  return `https://eypi.cc/${slug}${props.trackScans ? '?src=qr' : ''}`
})

const DOTS = new Set<LinkQrDotType>(['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'])
const FRAMES = new Set<LinkQrEyeFrameType>(['square', 'dot', 'extra-rounded'])
const BALLS = new Set<LinkQrEyeBallType>(['square', 'dot'])
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

let generation = 0
let logoRequests = 0

function beginLogoRequest() {
  logoRequests += 1
  if (logoRequests === 1) emit('uploading', true)
}

function endLogoRequest() {
  logoRequests = Math.max(0, logoRequests - 1)
  if (logoRequests === 0) emit('uploading', false)
}

async function paint() {
  await nextTick()
  const container = preview.value
  if (!container) return
  const current = ++generation
  try {
    const canvas = await renderLinkQrCanvas(240, dataUrl.value, props.config, 'white')
    if (current !== generation || preview.value !== container) return
    container.replaceChildren(canvas)
  } catch {
    if (current === generation) container.replaceChildren()
  }
}

watch([dataUrl, () => props.config], () => { void paint() }, { deep: true, immediate: true })

function onDot(event: Event) {
  const value = eventValue(event)
  if (value && DOTS.has(value as LinkQrDotType)) {
    emit('update:config', { ...props.config, dotType: value as LinkQrDotType })
  }
}

function onFrame(event: Event) {
  const value = eventValue(event)
  if (value && FRAMES.has(value as LinkQrEyeFrameType)) {
    emit('update:config', { ...props.config, eyeFrameType: value as LinkQrEyeFrameType })
  }
}

function onBall(event: Event) {
  const value = eventValue(event)
  if (value && BALLS.has(value as LinkQrEyeBallType)) {
    emit('update:config', { ...props.config, eyeBallType: value as LinkQrEyeBallType })
  }
}

function onColor(event: Event) {
  const value = eventValue(event)
  if (value != null) emit('update:config', { ...props.config, color: value })
}

async function removeLogo() {
  logoError.value = ''
  beginLogoRequest()
  try {
    if (props.linkId) {
      await api.put(`/api/links/${props.linkId}/qr-logo`, { imageData: null })
    }
    emit('update:config', { ...props.config, logoDataUrl: null })
  } catch (err) {
    logoError.value = err instanceof ApiError ? err.message : 'Could not remove that logo.'
  } finally {
    endLogoRequest()
  }
}

function eventValue(event: Event): string | null {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return target.value
  return null
}

function readFile(file: File): Promise<string> {
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

const QR_LOGO_PROFILE_WIDTH = 512

/** Width from a PNG data URL's IHDR, or null when it cannot be read. */
function pngDataUrlWidth(dataUrl: string): number | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]{32})/.exec(dataUrl)
  if (!match) return null
  try {
    const bytes = atob(match[1])
    if (bytes.slice(1, 4) !== 'PNG') return null
    return (bytes.charCodeAt(16) << 24 | bytes.charCodeAt(17) << 16 | bytes.charCodeAt(18) << 8 | bytes.charCodeAt(19)) >>> 0
  } catch {
    return null
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const type = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'image/png'
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/**
 * Resizes to the qrLogo profile (512 px) before saving; that single image is the
 * logo, with no variants call. Lazy-loaded, best-effort, and PNG only because the
 * QR logo store accepts nothing else: any other result keeps the input.
 */
async function fitQrLogo(dataUrl: string): Promise<string> {
  const width = pngDataUrlWidth(dataUrl)
  // Already within the profile: skip fetching the variants chunk for a no-op.
  if (width !== null && width <= QR_LOGO_PROFILE_WIDTH) return dataUrl
  try {
    const { makeVariants } = await import('@/lib/images/variants')
    const { variants } = await makeVariants(dataUrlToBlob(dataUrl), 'qrLogo')
    const resized = variants[0]?.dataUrl
    return resized?.startsWith('data:image/png;base64,') ? resized : dataUrl
  } catch {
    return dataUrl
  }
}

async function onLogo(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  if (!file) return
  logoError.value = ''
  if (!LOGO_TYPES.includes(file.type)) {
    logoError.value = 'Choose a PNG, JPEG, WebP, or GIF image.'
    input.value = ''
    return
  }
  if (file.size > QR_LOGO_PREVIEW_MAX_BYTES) {
    logoError.value = 'Choose an image smaller than 10 MB for preview.'
    input.value = ''
    return
  }
  beginLogoRequest()
  try {
    const raw = await readFile(file)
    const normalized = await fitQrLogo(await normalizeQrLogoDataUrl(raw))
    if (props.linkId) {
      const saved = await api.put<{ url: string }>(`/api/links/${props.linkId}/qr-logo`, {
        imageData: normalized,
      })
      emit('update:config', { ...props.config, logoDataUrl: saved.url })
    } else {
      emit('update:config', { ...props.config, logoDataUrl: normalized })
    }
  } catch (err) {
    logoError.value = err instanceof ApiError ? err.message : 'Could not read that image.'
  } finally {
    endLogoRequest()
    input.value = ''
  }
}

async function download() {
  if (exporting.value) return
  exporting.value = true
  try {
    let config = { ...props.config }
    if (config.logoDataUrl?.startsWith('data:')) {
      config.logoDataUrl = await normalizeQrLogoDataUrl(config.logoDataUrl)
    }
    // Exports are transparent PNGs of dark modules by design; the on-screen preview is always bg-white.
    await downloadLinkQrPng(1920, dataUrl.value, config, `eypi-qr-${props.slug || 'link'}`, 'transparent')
    toast.success('QR code exported.')
  } catch {
    toast.error('Could not export the QR code.')
  } finally {
    exporting.value = false
  }
}
</script>
