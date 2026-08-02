<template>
  <section class="relative mx-auto w-full max-w-3xl px-4 py-16">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="mx-auto h-8 w-2/3 animate-pulse rounded-lg bg-g-border" />
      <div class="aspect-square w-full animate-pulse rounded-2xl bg-g-border" />
    </div>

    <!-- Not found -->
    <Card v-else-if="error" className="text-center">
      <p class="text-sm font-semibold text-g-destructive">{{ error }}</p>
      <router-link
        to="/"
        class="mt-6 inline-block text-sm font-medium text-g-brand transition-colors hover:text-g-primary"
      >
        ← Back to eypi.cc
      </router-link>
    </Card>

    <!-- Editor -->
    <template v-else>
      <header class="mb-8 text-center reveal">
        <p class="text-eyebrow mb-3">DP Blast</p>
        <h1
          class="font-display font-bold tracking-tight text-g-text"
          style="font-size: clamp(1.75rem, 5vw, 3rem); letter-spacing: -0.03em;"
        >{{ campaign.title }}</h1>
        <p
          v-if="campaign.description"
          class="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-g-muted"
        >{{ campaign.description }}</p>
      </header>

      <!-- Canvas card -->
      <Card className="reveal delay-1 relative !p-5 sm:!p-8">
        <div
          class="dp-checker aspect-square w-full overflow-hidden border border-g-border relative transition-all duration-300"
          :class="previewShape === 'circle' ? 'rounded-full' : 'rounded-2xl'"
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
        <div v-if="frameImgs.length > 1" class="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            :class="buttonVariants({ variant: 'secondary', size: 'sm', className: 'h-9 w-9 px-0 rounded-full' })"
            aria-label="Previous frame"
            @click="prevFrame"
          >‹</button>
          <div class="flex items-center gap-1.5">
            <button
              v-for="(_, i) in frameImgs"
              :key="i"
              type="button"
              class="h-2.5 w-2.5 rounded-full transition-colors"
              :class="i === selectedIndex ? 'bg-g-primary' : 'bg-g-border'"
              :aria-label="`Frame ${i + 1}`"
              @click="selectedIndex = i"
            />
          </div>
          <button
            type="button"
            :class="buttonVariants({ variant: 'secondary', size: 'sm', className: 'h-9 w-9 px-0 rounded-full' })"
            aria-label="Next frame"
            @click="nextFrame"
          >›</button>
        </div>

        <p class="mt-3 text-center text-[0.65rem] uppercase tracking-widest text-g-muted">
          {{ frameImgs.length > 1 ? `Frame ${selectedIndex + 1} of ${frameImgs.length} · ` : '' }}Drag to reposition · scroll or pinch to zoom
        </p>

        <!-- Controls -->
        <div class="mt-6 flex flex-col gap-4">
          <label
            :class="buttonVariants({ variant: 'secondary', className: 'w-full cursor-pointer' })"
          >
            {{ headshot ? 'Change Photo' : 'Upload Your Photo' }}
            <input type="file" accept="image/*" class="hidden" @change="onHeadshotPicked" />
          </label>

          <div v-if="headshot" class="flex items-center gap-4">
            <span class="text-[0.65rem] uppercase tracking-widest text-g-muted">Zoom</span>
            <input
              v-model.number="zoomPercent"
              type="range"
              min="20"
              max="800"
              step="1"
              class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-g-border accent-[var(--color-primary)]"
            />
            <Button type="button" variant="ghost" size="sm" @click="reset">Reset</Button>
          </div>

          <!-- Preview shape toggler -->
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-xl border py-2.5 text-sm font-semibold transition-all"
              :class="previewShape === 'square'
                ? 'border-g-brand bg-g-brand text-white'
                : 'border-g-border text-g-muted hover:border-g-brand hover:text-g-brand'"
              @click="previewShape = 'square'"
            >
              Square Preview
            </button>
            <button
              type="button"
              class="rounded-xl border py-2.5 text-sm font-semibold transition-all"
              :class="previewShape === 'circle'
                ? 'border-g-brand bg-g-brand text-white'
                : 'border-g-border text-g-muted hover:border-g-brand hover:text-g-brand'"
              @click="previewShape = 'circle'"
            >
              Circle Preview
            </button>
          </div>

          <Button
            type="button"
            className="w-full"
            size="lg"
            :disabled="!headshot || exporting"
            @click="download"
          >{{ exporting ? 'Rendering…' : 'Download' }}</Button>
        </div>
      </Card>

      <!-- Caption -->
      <Card
        v-if="campaign.captionTemplate"
        className="reveal delay-2 relative mt-6"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <p class="text-sm font-semibold text-g-brand">Caption</p>
          <Button type="button" variant="ghost" size="sm" @click="copyCaption">
            Copy to clipboard
          </Button>
        </div>
        <p class="whitespace-pre-wrap text-sm leading-relaxed text-g-muted">{{ campaign.captionTemplate }}</p>
      </Card>
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
import type { DpFrame } from '@/types/dp'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'

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

const canvasRef = ref<HTMLCanvasElement | null>(null)
const frameImgs = ref<HTMLImageElement[]>([])
const selectedIndex = ref(0)
const headshot = ref<HTMLImageElement | null>(null)
const previewShape = ref<'square' | 'circle'>('square')

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

  // Selected frame on top, stretched to the (fixed) canvas size.
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
}

watch([scale, offsetX, offsetY, selectedIndex], scheduleDraw)

// ── Headshot input (never uploaded anywhere) ─────────────────────────────────
function onHeadshotPicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return }
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => { headshot.value = img; reset(); scheduleDraw() }
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
    if (!blob) { toast.error('Could not render the image. Try again.'); return }
    const safe = (campaign.slug || campaign.title || 'frame').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame'
    const suffix = frameImgs.value.length > 1 ? `-${selectedIndex.value + 1}` : ''
    saveAs(blob, `eypi-dp-${safe}${suffix}.png`)
    toast.success('Downloaded. Share your new profile picture.')
    fetch(`${API_BASE_URL}/api/dp/${campaign.id}/download`, { method: 'POST' }).catch(() => {})
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
    const res = await fetch(`${API_BASE_URL}/api/dp/${slug}`)
    let data: { status?: string; message?: string; campaign?: Campaign } = {}
    try { data = await res.json() } catch { /* non-JSON */ }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Campaign not found.')

    Object.assign(campaign, data.campaign)
    if (!campaign.frames.length) throw new Error('This campaign has no frames yet.')

    frameImgs.value = await Promise.all(campaign.frames.map(f => loadImage(f.imageUrl)))

    loading.value = false
    await nextTick()
    const canvas = canvasRef.value
    if (canvas) {
      // Force canvas backing store to be exactly 1080x1080 for high quality 1:1 exports
      canvas.width = 1080
      canvas.height = 1080
    }
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
