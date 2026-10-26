<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" :rows="2" />

    <!-- Not found -->
    <AppPage v-else-if="error" title="Frame not found">
      <div class="mica-card rounded-3xl border border-gray-200 p-8 text-center sm:p-12 dark:border-slate-600">
        <p role="alert" class="font-mono text-sm uppercase tracking-widest text-red-700 dark:text-red-400">{{ error }}</p>
        <router-link to="/" class="btn-secondary mt-6">← Back to eypi.cc</router-link>
      </div>
    </AppPage>

    <!-- Editor -->
    <AppPage v-else :title="campaign.title" :description="campaign.description ?? undefined">
    <div class="mx-auto w-full max-w-3xl">
      <!-- Canvas card -->
      <div class="mica-card reveal delay-1 relative rounded-3xl border border-gray-200 p-4 sm:p-8 dark:border-slate-600">
        <div
          class="dp-checker w-full overflow-hidden border border-gray-200 dark:border-slate-700 relative transition-all duration-300"
          :class="previewShape === 'circle' ? 'rounded-full' : 'rounded-3xl'"
          :style="{ aspectRatio: frameAspect }"
        >
          <canvas
            ref="canvasRef"
            class="absolute inset-0 h-full w-full select-none"
            style="touch-action: none;"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerleave="onPointerUp"
            @wheel.prevent="onWheel"
          />
        </div>

        <!-- Frame switcher -->
        <div v-if="frameImgs.length > 1" class="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-full border-2 border-gray-200 font-mono text-lg leading-none text-[#34418F] transition-colors hover:border-[#34418F] dark:border-slate-600 dark:text-slate-200"
            aria-label="Previous frame"
            @click="prevFrame"
          >‹</button>
          <div class="flex items-center gap-1.5">
            <button
              v-for="(_, i) in frameImgs"
              :key="i"
              type="button"
              class="relative size-3 rounded-full transition-colors before:absolute before:-inset-4 before:content-['']"
              :class="i === selectedIndex ? 'bg-[#DEAC4B]' : 'bg-gray-300 dark:bg-slate-600'"
              :aria-label="`Frame ${i + 1}`"
              @click="selectedIndex = i"
            />
          </div>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-full border-2 border-gray-200 font-mono text-lg leading-none text-[#34418F] transition-colors hover:border-[#34418F] dark:border-slate-600 dark:text-slate-200"
            aria-label="Next frame"
            @click="nextFrame"
          >›</button>
        </div>

        <p class="mt-3 text-center font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-slate-500">
          {{ frameImgs.length > 1 ? `Frame ${selectedIndex + 1} of ${frameImgs.length} · ` : '' }}Drag to reposition · scroll or pinch to zoom
        </p>

        <!-- Controls -->
        <div class="mt-6 flex flex-col gap-4">
          <label class="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#34418F] px-6 text-base font-semibold text-[#34418F] transition-colors hover:bg-[#34418F] hover:text-white dark:border-slate-400 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100">
            {{ headshot ? 'Change Photo' : 'Upload Your Photo' }}
            <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onHeadshotPicked" />
          </label>

          <div v-if="headshot" class="flex items-center gap-4">
            <label for="frame-zoom" class="font-mono text-xs uppercase tracking-widest text-gray-400 dark:text-slate-500">Zoom</label>
            <input
              id="frame-zoom"
              v-model.number="zoomPercent"
              type="range"
              min="20"
              max="800"
              step="1"
              class="h-11 flex-1 cursor-pointer accent-[#DEAC4B]"
            />
            <button
              type="button"
              class="btn-secondary"
              @click="reset"
            >Reset</button>
          </div>

          <!-- Preview shape toggler -->
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="min-h-11 rounded-xl border text-sm font-semibold transition-all"
              :class="previewShape === 'square'
                ? 'border-[#34418F] bg-[#34418F] text-white dark:border-slate-400 dark:bg-slate-700 dark:text-slate-100'
                : 'border-gray-200 text-gray-500 hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-400 dark:hover:text-slate-200'"
              @click="previewShape = 'square'"
            >
              Square Preview
            </button>
            <button
              type="button"
              class="min-h-11 rounded-xl border text-sm font-semibold transition-all"
              :class="previewShape === 'circle'
                ? 'border-[#34418F] bg-[#34418F] text-white dark:border-slate-400 dark:bg-slate-700 dark:text-slate-100'
                : 'border-gray-200 text-gray-500 hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-400 dark:hover:text-slate-200'"
              @click="previewShape = 'circle'"
            >
              Circle Preview
            </button>
          </div>

          <button
            type="button"
            :disabled="!headshot || exporting"
 class="btn-gold min-h-11 w-full rounded-xl px-8 text-base font-semibold transition-all"
            :class="(!headshot || exporting) ? 'cursor-not-allowed opacity-50' : 'hover:brightness-110 hover:-translate-y-0.5'"
            @click="download"
          >{{ exporting ? 'Rendering…' : 'Download' }}</button>
        </div>
      </div>

      <!-- Caption -->
      <div
        v-if="campaign.captionTemplate"
        class="mica-card reveal delay-2 relative mt-6 rounded-3xl border border-gray-200 p-6 dark:border-slate-600"
      >
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-[#34418F] dark:text-slate-300">Caption</p>
          <button
            type="button"
            class="btn-secondary"
            @click="copyCaption"
          >Copy to clipboard</button>
        </div>
        <p class="whitespace-pre-wrap font-mono text-sm leading-relaxed" style="color: var(--color-text-muted);">{{ campaign.captionTemplate }}</p>
      </div>
    </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { saveAs } from 'file-saver'
import { useToast } from '@/composables/useToast'
import { useReveal } from '@/composables/useReveal'
import { useDpCanvas } from '@/composables/useDpCanvas'
import type { DpFrame } from '@/types/dp'

const route = useRoute()
const toast = useToast()
useReveal()

const slug = route.params.slug as string

interface Campaign {
  id: string
  title: string
  slug: string
  description: string | null
  captionTemplate: string | null
  frames: DpFrame[]
}

const loading = ref(true)
const error = ref('')
const exporting = ref(false)
const campaign = reactive<Campaign>({ id: '', title: '', slug: '', description: null, captionTemplate: null, frames: [] })

const MAX_PHOTO_EDGE = 2160
const PHOTO_ERROR = "We couldn't read that photo. Try a JPG or PNG."

type PhotoSource = HTMLImageElement | ImageBitmap

const canvasRef = ref<HTMLCanvasElement | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const frameImgs = ref<HTMLImageElement[]>([])
const selectedIndex = ref(0)
const headshot = ref<PhotoSource | null>(null)
const previewShape = ref<'square' | 'circle'>('square')

const frameAspect = computed(() => {
  const frame = frameImgs.value[selectedIndex.value]
  const width = frame?.naturalWidth || frame?.width || 0
  const height = frame?.naturalHeight || frame?.height || 0
  if (!width || !height) return '1 / 1'
  return `${width} / ${height}`
})

const { scale, offsetX, offsetY, onPointerDown, onPointerMove, onPointerUp, onWheel, reset } = useDpCanvas(canvasRef)

const MIN_SCALE = 0.2
const MAX_SCALE = 8
const zoomPercent = computed({
  get: () => Math.round(scale.value * 100),
  set: (v: number) => {
    const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v / 100))
    const k = target / scale.value
    offsetX.value *= k
    offsetY.value *= k
    scale.value = target
  },
})

function prevFrame() { selectedIndex.value = (selectedIndex.value - 1 + frameImgs.value.length) % frameImgs.value.length }
function nextFrame() { selectedIndex.value = (selectedIndex.value + 1) % frameImgs.value.length }

// ── Rendering ────────────────────────────────────────────────────────────────
let rafId = 0
function scheduleDraw() {
  if (rafId) return
  rafId = requestAnimationFrame(() => { rafId = 0; draw() })
}

function draw() {
  const canvas = canvasRef.value
  const frame = frameImgs.value[selectedIndex.value]
  if (!canvas || !frame) return
  const width = frame.naturalWidth || frame.width
  const height = frame.naturalHeight || frame.height
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const photo = headshot.value
  if (photo) {
    const base = Math.max(canvas.width / photo.width, canvas.height / photo.height)
    const drawW = photo.width * base * scale.value
    const drawH = photo.height * base * scale.value
    const cx = canvas.width / 2 + offsetX.value
    const cy = canvas.height / 2 + offsetY.value
    ctx.drawImage(photo, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  }

  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
}

watch([scale, offsetX, offsetY, selectedIndex], scheduleDraw)

// ── Headshot input (never uploaded anywhere) ─────────────────────────────────
async function downscalePhoto(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file)
  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest <= MAX_PHOTO_EDGE) return bitmap
  const scale = MAX_PHOTO_EDGE / longest
  const resized = await createImageBitmap(bitmap, {
    resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
    resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
    resizeQuality: 'high',
  })
  bitmap.close()
  return resized
}

async function onHeadshotPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const bitmap = await downscalePhoto(file)
    if (headshot.value && 'close' in headshot.value) headshot.value.close()
    headshot.value = bitmap
    reset()
    scheduleDraw()
  } catch {
    toast.error(PHOTO_ERROR)
  } finally {
    input.value = ''
  }
}

// ── Export ───────────────────────────────────────────────────────────────────
async function download() {
  const canvas = canvasRef.value
  if (!canvas || !headshot.value) return
  exporting.value = true
  try {
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) { toast.error('Could not render the image. Try again.'); return }
    const safe = (campaign.slug || campaign.title || 'frame').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame'
    const suffix = frameImgs.value.length > 1 ? `-${selectedIndex.value + 1}` : ''
    const filename = `eypi-dp-${safe}${suffix}.png`
    const file = new File([blob], filename, { type: 'image/png' })
    const shared = await sharePhoto(file)
    if (shared === 'cancelled') return
    if (!shared) {
      saveAs(blob, filename)
      toast.success('Downloaded. Share your new profile picture.')
    }
    api.raw(`/api/dp/${campaign.id}/download`, { method: 'POST' }).catch(() => {})
  } catch {
    toast.error('Export failed. Try again.')
  } finally {
    exporting.value = false
  }
}

async function sharePhoto(file: File): Promise<boolean | 'cancelled'> {
  if (typeof navigator.share !== 'function') return false
  const payload = { files: [file] }
  if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) return false
  try {
    await navigator.share(payload)
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return false
  }
}

async function copyCaption() {
  if (!campaign.captionTemplate) return
  try {
    await navigator.clipboard.writeText(campaign.captionTemplate)
    toast.success('Caption copied to clipboard!')
  } catch {
    toast.error('Could not copy the caption.')
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('A frame image failed to load.'))
    img.src = src
  })
}

// ── Load campaign ─────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await api.raw(`/api/dp/${slug}`)
    let data: { status?: string; message?: string; campaign?: Campaign } = {}
    try { data = await res.json() } catch { /* non-JSON */ }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Campaign not found.')

    Object.assign(campaign, data.campaign)
    if (!campaign.frames.length) throw new Error('This campaign has no frames yet.')

    frameImgs.value = await Promise.all(campaign.frames.map((frame) => loadImage(frame.url)))

    loading.value = false
    await nextTick()
    scheduleDraw()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Campaign not found.'
    loading.value = false
  }
})
</script>

<style scoped>
.dp-checker {
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #e9e9e9 25%, transparent 25%),
    linear-gradient(-45deg, #e9e9e9 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e9e9e9 75%),
    linear-gradient(-45deg, transparent 75%, #e9e9e9 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
:global(html.dark) .dp-checker {
  background-color: #0d0d0d;
  background-image:
    linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
    linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
}
</style>
