<template>
  <section class="mt-8 border-t border-gray-200 pt-8 dark:border-slate-700">
    <h3 class="text-card-title mb-4 text-gray-500 dark:text-slate-400">
      QR code
    </h3>
    <div class="mb-6 flex justify-center">
      <div
        ref="preview"
        class="rounded-xl border-2 border-gray-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800/50"
      />
    </div>
    <label class="mb-4 flex items-center gap-2 text-sm text-g-text">
      <input
        class="h-4 w-4 accent-g-accent"
        type="checkbox"
        :checked="trackScans"
        @change="onTrack"
      >
      Track QR scans
    </label>
    <div class="mb-6 flex flex-col gap-4 text-sm">
      <div class="flex flex-col gap-1">
        <label
          class="text-sm font-medium text-gray-500 dark:text-slate-400"
          for="qr-body-shape"
        >Body shape</label>
        <select
          id="qr-body-shape"
          class="rounded-lg border-2 border-gray-200 bg-white p-2 outline-none focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
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
        <div class="flex flex-col gap-1">
          <label
            class="text-sm font-medium text-gray-500 dark:text-slate-400"
            for="qr-eye-frame"
          >Eye frame</label>
          <select
            id="qr-eye-frame"
            class="rounded-lg border-2 border-gray-200 bg-white p-2 outline-none focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
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
        <div class="flex flex-col gap-1">
          <label
            class="text-sm font-medium text-gray-500 dark:text-slate-400"
            for="qr-eye-ball"
          >Eye ball</label>
          <select
            id="qr-eye-ball"
            class="rounded-lg border-2 border-gray-200 bg-white p-2 outline-none focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
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
      <div class="flex flex-col gap-1">
        <label
          class="text-sm font-medium text-gray-500 dark:text-slate-400"
          for="qr-matrix-color"
        >Matrix color</label>
        <input
          id="qr-matrix-color"
          class="w-full rounded-lg border-2 border-gray-200 bg-white p-2 font-mono text-sm uppercase outline-none focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
          maxlength="7"
          type="text"
          :value="config.color"
          @input="onColor"
        >
      </div>
      <div class="flex flex-col gap-1">
        <label
          class="text-sm font-medium text-gray-500 dark:text-slate-400"
          for="qr-center-logo"
        >Center logo</label>
        <input
          id="qr-center-logo"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="text-xs"
          type="file"
          :aria-describedby="logoError ? 'logo-error' : logoHint ? 'logo-persist-hint' : undefined"
          :aria-invalid="Boolean(logoError)"
          @change="onLogo"
        >
        <button
          v-if="config.logoDataUrl"
          class="self-start text-xs font-medium text-gray-500 underline-offset-2 hover:underline dark:text-slate-400"
          type="button"
          @click="removeLogo"
        >
          Remove logo
        </button>
        <p
          v-if="logoError"
          id="logo-error"
          class="text-sm text-red-500"
          role="alert"
        >
          {{ logoError }}
        </p>
        <p
          v-else-if="logoHint"
          id="logo-persist-hint"
          class="text-sm text-amber-600 dark:text-amber-400"
        >
          This logo is larger than 2 MB. Preview and export include it, but save keeps the style without the logo.
        </p>
      </div>
    </div>
    <button
      class="flex w-full items-center justify-center rounded-lg border-2 border-g-primary px-6 py-3 text-sm font-semibold text-g-primary hover:border-g-accent hover:text-g-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-400 dark:text-slate-200"
      type="button"
      :disabled="exporting"
      @click="download"
    >
      {{ exporting ? 'Exporting…' : 'Export PNG' }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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

function onTrack(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('update:trackScans', target.checked)
}

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
  if (props.linkId) {
    try {
      await api.put(`/api/links/${props.linkId}/qr-logo`, { imageData: null })
    } catch (err) {
      logoError.value = err instanceof ApiError ? err.message : 'Could not remove that logo.'
      return
    }
  }
  emit('update:config', { ...props.config, logoDataUrl: null })
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
  try {
    const raw = await readFile(file)
    const normalized = await normalizeQrLogoDataUrl(raw)
    if (props.linkId) {
      const saved = await api.put<{ url: string }>(`/api/links/${props.linkId}/qr-logo`, {
        imageData: normalized,
      })
      emit('update:config', { ...props.config, logoDataUrl: saved.url })
    } else {
      emit('update:config', { ...props.config, logoDataUrl: normalized })
    }
    input.value = ''
  } catch (err) {
    logoError.value = err instanceof ApiError ? err.message : 'Could not read that image.'
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
    await downloadLinkQrPng(1920, dataUrl.value, config, `eypi-qr-${props.slug || 'link'}`, 'transparent')
    toast.success('QR code exported.')
  } catch {
    toast.error('Could not export the QR code.')
  } finally {
    exporting.value = false
  }
}
</script>
