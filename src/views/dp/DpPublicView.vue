<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" :rows="2" />

    <!-- Not found -->
    <AppPage v-else-if="error" title="Frame not found">
      <Card class="gap-0 rounded-3xl p-8 text-center sm:p-12">
        <p role="alert" class="font-mono text-sm text-destructive">{{ error }}</p>
        <Button as-child variant="outline" class="mx-auto mt-6">
          <router-link to="/">← Back to eypi.cc</router-link>
        </Button>
      </Card>
    </AppPage>

    <!-- Editor -->
    <AppPage v-else :title="campaign.title" :description="campaign.description ?? undefined">
    <div class="mx-auto w-full max-w-3xl">
      <!-- Canvas card -->
      <Card class="relative gap-0 rounded-3xl p-4 sm:p-8">
        <!-- Preview container only; the canvas below is composited from the photo and frame alone -->
        <div
          class="relative w-full overflow-hidden border border-border bg-muted bg-dot-grid transition-all duration-300"
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            class="rounded-full font-mono text-lg leading-none"
            aria-label="Previous frame"
            @click="prevFrame"
          >‹</Button>
          <div class="flex items-center gap-1.5">
            <button
              v-for="(_, i) in frameImgs"
              :key="i"
              type="button"
              class="relative size-3 rounded-full transition-colors outline-none before:absolute before:-inset-4 before:content-[''] focus-visible:ring-3 focus-visible:ring-ring/50"
              :class="i === selectedIndex ? 'bg-primary' : 'bg-muted-foreground/40'"
              :aria-label="`Frame ${i + 1}`"
              :aria-current="i === selectedIndex ? 'true' : undefined"
              @click="selectedIndex = i"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            class="rounded-full font-mono text-lg leading-none"
            aria-label="Next frame"
            @click="nextFrame"
          >›</Button>
        </div>

        <p class="mt-3 text-center font-mono text-xs text-muted-foreground">
          {{ frameImgs.length > 1 ? `Frame ${selectedIndex + 1} of ${frameImgs.length} · ` : '' }}Drag to reposition · scroll or pinch to zoom
        </p>

        <!-- Controls -->
        <div class="mt-6 flex flex-col gap-4">
          <Button as-child variant="outline" class="w-full cursor-pointer font-semibold focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <label>
              {{ headshot ? 'Change Photo' : 'Upload Your Photo' }}
              <input ref="photoInput" type="file" accept="image/*" class="sr-only" @change="onHeadshotPicked" />
            </label>
          </Button>

          <div v-if="headshot" class="flex items-center gap-4">
            <Label class="w-auto font-mono text-xs text-muted-foreground">Zoom</Label>
            <Slider
              class="h-11 flex-1"
              thumb-label="Zoom"
              :model-value="[zoomPercent]"
              :min="20"
              :max="800"
              :step="1"
              @update:model-value="onZoom"
            />
            <Button type="button" variant="outline" @click="reset">Reset</Button>
          </div>

          <!-- Preview shape toggler -->
          <div class="grid grid-cols-2 gap-3">
            <Button
              type="button"
              :variant="previewShape === 'square' ? 'default' : 'outline'"
              :aria-pressed="previewShape === 'square'"
              class="min-h-11 text-sm font-semibold"
              @click="previewShape = 'square'"
            >
              Square Preview
            </Button>
            <Button
              type="button"
              :variant="previewShape === 'circle' ? 'default' : 'outline'"
              :aria-pressed="previewShape === 'circle'"
              class="min-h-11 text-sm font-semibold"
              @click="previewShape = 'circle'"
            >
              Circle Preview
            </Button>
          </div>

          <Button
            type="button"
            size="lg"
            :disabled="!headshot || exporting"
            class="w-full font-semibold"
            @click="download"
          >{{ exporting ? 'Rendering…' : 'Download' }}</Button>
        </div>
      </Card>

      <!-- Caption -->
      <Card
        v-if="campaign.captionTemplate"
        class="relative mt-6 gap-0 rounded-3xl p-6"
      >
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-foreground">Caption</p>
          <Button type="button" variant="outline" @click="copyCaption">Copy to clipboard</Button>
        </div>
        <p class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground">{{ campaign.captionTemplate }}</p>
      </Card>
    </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { saveAs } from 'file-saver'
import { useToast } from '@/composables/useToast'
import { useDpCanvas } from '@/composables/useDpCanvas'
import type { DpFrame } from '@/types/dp'

const route = useRoute()
const toast = useToast()

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

function onZoom(value: number[] | undefined) {
  const next = value?.[0]
  if (typeof next === 'number') zoomPercent.value = next
}

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

