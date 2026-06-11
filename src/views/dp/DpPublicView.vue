<template>
  <section class="relative mx-auto w-full max-w-3xl px-4 py-16">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="mx-auto h-8 w-2/3 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
      <div class="aspect-square w-full animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <!-- Not found -->
    <div
      v-else-if="error"
      class="mica-card rounded-3xl border border-gray-200 p-12 text-center dark:border-slate-600"
    >
      <p class="font-mono text-sm uppercase tracking-widest text-red-500">{{ error }}</p>
      <router-link
        to="/"
        class="mt-6 inline-block font-mono text-xs uppercase tracking-widest text-[#34418F] hover:text-[#DEAC4B] dark:text-slate-300"
      >← Back to eypi.cc</router-link>
    </div>

    <!-- Editor -->
    <template v-else>
      <header class="mb-8 text-center reveal">
        <p class="mb-3 font-mono text-xs uppercase tracking-[0.3em]" style="color: var(--color-text-muted);">
          DP Blast
        </p>
        <h1
          class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
          style="font-size: clamp(1.75rem, 5vw, 3rem); letter-spacing: -0.03em;"
          data-cursor="text"
        >
          {{ campaign.title }}
        </h1>
        <p
          v-if="campaign.description"
          class="mx-auto mt-3 max-w-xl font-mono text-sm leading-relaxed"
          style="color: var(--color-text-muted);"
        >
          {{ campaign.description }}
        </p>
      </header>

      <!-- Canvas card -->
      <div class="mica-card reveal delay-1 relative rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">
        <!-- Checkerboard backdrop so frame transparency is visible -->
        <div class="dp-checker overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700">
          <canvas
            ref="canvasRef"
            class="block h-auto w-full select-none"
            style="touch-action: none;"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerleave="onPointerUp"
            @wheel.prevent="onWheel"
          />
        </div>

        <p class="mt-3 text-center font-mono text-[0.65rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">
          Drag to reposition · scroll or pinch to zoom
        </p>

        <!-- Controls -->
        <div class="mt-6 flex flex-col gap-4">
          <!-- Upload headshot -->
          <label
            class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#34418F] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-[#34418F] transition-colors hover:bg-[#34418F] hover:text-white dark:border-slate-400 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            {{ headshot ? 'Change Photo' : 'Upload Your Photo' }}
            <input type="file" accept="image/*" class="hidden" @change="onHeadshotPicked" />
          </label>

          <!-- Zoom + reset (only meaningful once a photo is loaded) -->
          <div v-if="headshot" class="flex items-center gap-4">
            <span class="font-mono text-[0.65rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Zoom</span>
            <input
              v-model.number="zoomPercent"
              type="range"
              min="20"
              max="800"
              step="1"
              class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#DEAC4B] dark:bg-slate-700"
            />
            <button
              type="button"
              class="rounded-lg border border-gray-200 px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
              @click="reset"
            >Reset</button>
          </div>

          <!-- Download -->
          <button
            type="button"
            :disabled="!headshot || exporting"
            class="w-full rounded-xl bg-[#DEAC4B] px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all dark:bg-eypi-gold-dark dark:text-slate-100"
            :class="(!headshot || exporting) ? 'cursor-not-allowed opacity-50' : 'hover:brightness-110 hover:-translate-y-0.5'"
            @click="download"
          >
            {{ exporting ? 'Rendering…' : 'Download' }}
          </button>
        </div>
      </div>

      <!-- Caption -->
      <div
        v-if="campaign.captionTemplate"
        class="mica-card reveal delay-2 relative mt-6 rounded-3xl border border-gray-200 p-6 dark:border-slate-600"
      >
        <div class="mb-3 flex items-center justify-between">
          <p class="font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Caption</p>
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
            @click="copyCaption"
          >Copy to clipboard</button>
        </div>
        <p class="whitespace-pre-wrap font-mono text-sm leading-relaxed" style="color: var(--color-text-muted);">{{ campaign.captionTemplate }}</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { saveAs } from 'file-saver'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useReveal } from '@/composables/useReveal'
import { useDpCanvas } from '@/composables/useDpCanvas'

const route = useRoute()
const toast = useToast()
useReveal()

const campaignId = route.params.campaignId as string

interface Campaign {
  id: string
  title: string
  description: string | null
  frameImageUrl: string
  captionTemplate: string | null
}

const loading = ref(true)
const error = ref('')
const exporting = ref(false)
const campaign = reactive<Campaign>({ id: '', title: '', description: null, frameImageUrl: '', captionTemplate: null })

const canvasRef = ref<HTMLCanvasElement | null>(null)
const frameImg = ref<HTMLImageElement | null>(null)
const headshot = ref<HTMLImageElement | null>(null)

const { scale, offsetX, offsetY, onPointerDown, onPointerMove, onPointerUp, onWheel, reset } = useDpCanvas(canvasRef)

const MIN_SCALE = 0.2
const MAX_SCALE = 8
const zoomPercent = computed({
  get: () => Math.round(scale.value * 100),
  set: (v: number) => {
    const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v / 100))
    const k = target / scale.value
    // Zoom about the canvas centre (see useDpCanvas: focal == centre ⇒ offset *= k).
    offsetX.value *= k
    offsetY.value *= k
    scale.value = target
  },
})

// ── Rendering ────────────────────────────────────────────────────────────────
let rafId = 0
function scheduleDraw() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    draw()
  })
}

function draw() {
  const canvas = canvasRef.value
  const frame = frameImg.value
  if (!canvas || !frame) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Layer 1 — the user's headshot, cover-fit then transformed by scale/offset.
  const photo = headshot.value
  if (photo) {
    const base = Math.max(canvas.width / photo.width, canvas.height / photo.height)
    const drawW = photo.width * base * scale.value
    const drawH = photo.height * base * scale.value
    const cx = canvas.width / 2 + offsetX.value
    const cy = canvas.height / 2 + offsetY.value
    ctx.drawImage(photo, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  }

  // Layer 2 — the frame on top at full canvas size.
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
}

watch([scale, offsetX, offsetY], scheduleDraw)

// ── Headshot input (never uploaded anywhere) ─────────────────────────────────
function onHeadshotPicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('Please choose an image file.')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      headshot.value = img
      reset()
      scheduleDraw()
    }
    img.src = reader.result as string
  }
  reader.readAsDataURL(file)
}

// ── Export ───────────────────────────────────────────────────────────────────
async function download() {
  const canvas = canvasRef.value
  if (!canvas || !headshot.value) return
  exporting.value = true
  try {
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      toast.error('Could not render the image. Try again.')
      return
    }
    const safeTitle = (campaign.title || 'frame').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame'
    saveAs(blob, `eypi-dp-${safeTitle}.png`)
    toast.success('Downloaded! Share your new profile picture 🎉')

    // Best-effort, non-blocking counter bump.
    fetch(`${API_BASE_URL}/api/dp/${campaignId}/download`, { method: 'POST' }).catch(() => {})
  } catch {
    toast.error('Export failed. Try again.')
  } finally {
    exporting.value = false
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

// ── Load campaign ─────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${campaignId}`)
    // Parse defensively: a non-JSON body (gateway error, route not deployed)
    // should still degrade to a clean "not found" rather than a parser error.
    let data: { status?: string; message?: string; campaign?: Campaign } = {}
    try { data = await res.json() } catch { /* leave data empty */ }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Campaign not found.')

    Object.assign(campaign, data.campaign)

    await new Promise<void>((resolve, rejectFrame) => {
      const img = new Image()
      img.onload = () => {
        frameImg.value = img
        resolve()
      }
      img.onerror = () => rejectFrame(new Error('Frame image failed to load.'))
      img.src = campaign.frameImageUrl
    })

    await nextTick()
    const canvas = canvasRef.value
    if (canvas && frameImg.value) {
      // Native frame resolution → a crisp, high-quality export.
      canvas.width = frameImg.value.naturalWidth || frameImg.value.width
      canvas.height = frameImg.value.naturalHeight || frameImg.value.height
    }
    scheduleDraw()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Campaign not found.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* Checkerboard so transparent frame regions read as "see-through". */
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
