<template>
  <div
    class="relative flex flex-col gap-4"
    data-booth-studio
  >
    <p
      class="sr-only"
      aria-live="polite"
      data-booth-announce
    >
      {{ announcement }}
    </p>

    <div
      v-if="inApp"
      class="rounded-2xl border border-border bg-muted p-4 text-sm"
    >
      <p class="font-semibold text-foreground">
        Open in your browser
      </p>
      <p class="mt-1 text-muted-foreground">
        This app's built-in browser often blocks the camera. Open the menu (⋯) and choose Open in browser, or choose photos instead.
      </p>
    </div>

    <p
      v-if="failure || photoError"
      role="alert"
      class="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
    >
      {{ photoError ? PHOTO_ERROR : FAILURE_MESSAGES[failure!] }}
    </p>

    <!-- Live viewfinder: cropped to the next window, outlined like it -->
    <div
      v-if="showViewfinder"
      data-booth-viewfinder
      class="relative mx-auto w-full overflow-hidden rounded-3xl border border-border bg-muted"
      :class="state.phase === 'flash' ? 'ring-4 ring-primary' : ''"
      :style="viewfinderStyle"
    >
      <!-- The camera feeds this full-size video (iOS Safari stops decoding tiny or hidden ones); the filtered canvas covers it. -->
      <video
        ref="videoRef"
        class="pointer-events-none absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
        muted
        playsinline
        autoplay
      />
      <canvas
        ref="previewRef"
        data-booth-preview
        role="img"
        :aria-label="`Camera preview for photo ${activeIndex + 1} of ${SHOT_COUNT}`"
        class="absolute inset-0 h-full w-full"
        :class="facing === 'user' ? '-scale-x-100' : ''"
      />
      <div
        data-booth-outline
        aria-hidden="true"
        class="pointer-events-none absolute inset-2 rounded-2xl border-2 border-dashed border-primary"
      />
      <p class="absolute top-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
        Shot {{ activeIndex + 1 }} of {{ SHOT_COUNT }}
      </p>
      <p
        v-if="state.phase === 'counting' || state.phase === 'flash'"
        aria-hidden="true"
        class="absolute inset-0 m-auto grid h-24 min-w-24 place-items-center justify-self-center rounded-full bg-background/80 px-6 text-5xl font-semibold text-foreground"
      >
        {{ state.phase === 'flash' ? 'Smile!' : state.secondsLeft }}
      </p>
    </div>

    <div
      v-else-if="showCameraPrompt"
      class="mx-auto flex w-full flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-muted p-6 text-center"
      :style="viewfinderStyle"
    >
      <p class="text-sm text-muted-foreground">
        Take {{ SHOT_COUNT }} photos for your strip. They stay on this device.
      </p>
      <Button
        type="button"
        :disabled="cameraState === 'opening'"
        @click="startCamera"
      >
        {{ cameraState === 'opening' ? 'Opening camera…' : 'Open camera' }}
      </Button>
    </div>

    <p
      v-if="missingShot"
      role="status"
      class="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground"
    >
      {{ MISSING_SHOT_MESSAGE }}
    </p>

    <BoothStrip
      v-if="showStrip"
      :frame="frame"
      :windows="windows"
      :shots="state.shots"
      :filter="filter"
      :mode="mode"
      :disabled="busy"
      @select="onSlot"
    />

    <BoothFilterChips
      v-model="filter"
      :disabled="busy"
    />

    <div class="flex flex-col gap-3">
      <template v-if="mode === 'camera'">
        <Button
          v-if="state.phase !== 'review'"
          type="button"
          size="lg"
          class="w-full font-semibold"
          :disabled="busy || cameraState !== 'live'"
          @click="start"
        >
          Start
        </Button>
        <Button
          v-else
          type="button"
          variant="outline"
          class="w-full"
          :disabled="busy || cameraState === 'opening'"
          @click="startOver"
        >
          Start over
        </Button>
        <Button
          v-if="cameraState === 'live'"
          type="button"
          variant="outline"
          class="w-full"
          :disabled="busy"
          @click="flip"
        >
          {{ facing === 'user' ? 'Switch to back camera' : 'Switch to front camera' }}
        </Button>
        <Button
          type="button"
          variant="outline"
          class="w-full"
          :disabled="busy"
          @click="chooseGallery"
        >
          Choose photos instead
        </Button>
      </template>
      <template v-else>
        <Button
          type="button"
          class="w-full"
          @click="pickPhotos(null)"
        >
          Choose photos
        </Button>
        <Button
          type="button"
          variant="outline"
          class="w-full"
          @click="useCamera"
        >
          Use the camera instead
        </Button>
      </template>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        @change="onFilesPicked"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import BoothFilterChips from './BoothFilterChips.vue'
import BoothStrip from './BoothStrip.vue'
import { boothDepsKey, defaultBoothDeps, type Facing } from './boothDeps'
import { classifyCameraError, isInAppBrowser, stopStream, type CameraFailure } from '@/lib/booth/camera'
import { COUNTDOWN_SECONDS, SHOT_COUNT, createBoothSession, type BoothState } from '@/lib/booth/session'
import { composeStrip, coverCrop } from '@/lib/booth/compose'
import { applyFilter, type BoothFilterId } from '@/lib/booth/filters'
import { createScratch, releaseShot, shotSize } from '@/lib/booth/capture'
import { BOOTH_HEIGHT, BOOTH_WIDTH, type BoothWindow } from '@shared/boothWindows'

const props = defineProps<{ frame: HTMLImageElement; windows: BoothWindow[] }>()
const emit = defineEmits<{ 'update:ready': [ready: boolean] }>()

const deps = { ...defaultBoothDeps, ...inject(boothDepsKey, {}) }

const PREVIEW_EDGE = 1080
const HIDDEN_STOP_MS = 30_000
const MISSING_SHOT_MESSAGE = "That photo didn't come out. Tap it to retake."
const PHOTO_ERROR = "We couldn't read that photo. Try a JPG or PNG."
const FAILURE_MESSAGES: Record<CameraFailure, string> = {
  denied: 'Camera access is blocked. Allow the camera for this site in your browser settings and try again, or choose photos instead.',
  none: "We couldn't find a camera on this device. Choose photos instead.",
  insecure: 'The camera only works on a secure (https) page. Choose photos instead.',
  unsupported: "This browser can't open the camera. Choose photos instead.",
  other: "The camera couldn't start. Try again, or choose photos instead.",
}

/** As wide as the card allows, but never taller than 80% of the screen, whatever the window's shape. */
const viewfinderStyle = computed(() => {
  const { w, h } = activeWindow.value
  return { aspectRatio: `${w} / ${h}`, width: `min(100%, calc(80dvh * ${w} / ${h}))` }
})
const videoRef = ref<HTMLVideoElement | null>(null)
const previewRef = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const inApp = isInAppBrowser(deps.userAgent())
const mode = ref<'camera' | 'gallery'>('camera')
const facing = ref<Facing>('user')
const cameraState = ref<'off' | 'opening' | 'live'>('off')
const stream = shallowRef<MediaStream | null>(null)
const failure = ref<CameraFailure | null>(null)
const photoError = ref(false)
const filter = ref<BoothFilterId>('normal')
const state = shallowRef<BoothState>({ phase: 'idle', shots: Array(SHOT_COUNT).fill(null), currentIndex: 0, secondsLeft: 0 })
let held: (CanvasImageSource | null)[] = []
let disposed = false

const session = createBoothSession({
  capture: async () => {
    const video = videoRef.value
    if (!video || !stream.value) return null
    return deps.capture(video)
  },
  onChange: (next) => {
    // Free every capture the session no longer holds (a retake, a restart or a reset).
    for (const old of held) if (old && !next.shots.includes(old)) releaseShot(old)
    held = next.shots.slice()
    state.value = next
    // The strip is finished: the camera is not needed until a retake.
    if (next.phase === 'review' && mode.value === 'camera' && next.shots.every(Boolean)) stopCamera()
  },
})

const busy = computed(() => state.value.phase === 'counting' || state.value.phase === 'flash')
const ready = computed(() => props.windows.length >= SHOT_COUNT && state.value.shots.length >= SHOT_COUNT && state.value.shots.every(Boolean))
const activeIndex = computed(() => {
  if (busy.value) return state.value.currentIndex
  const empty = state.value.shots.findIndex((s) => !s)
  return empty === -1 ? 0 : empty
})
const activeWindow = computed(() => props.windows[activeIndex.value] ?? { x: 0, y: 0, w: 3, h: 4 })
const showViewfinder = computed(() => mode.value === 'camera' && cameraState.value === 'live' && state.value.phase !== 'review')
const showCameraPrompt = computed(() => mode.value === 'camera' && cameraState.value !== 'live' && state.value.phase !== 'review')
const missingShot = computed(() => mode.value === 'camera' && state.value.phase === 'review' && state.value.shots.some((s) => !s))
const showStrip = computed(() => state.value.phase === 'review' || mode.value === 'gallery')

const announcement = computed(() => {
  const { phase, currentIndex, secondsLeft } = state.value
  const n = currentIndex + 1
  if (phase === 'counting') return secondsLeft === COUNTDOWN_SECONDS ? `Shot ${n} of ${SHOT_COUNT}. ${secondsLeft}` : String(secondsLeft)
  if (phase === 'flash') return `Smile! Shot ${n} taken.`
  if (phase === 'review' && ready.value) return `Your strip is ready. Tap a photo to ${mode.value === 'camera' ? 'retake' : 'replace'} it.`
  return ''
})

watch(ready, (value) => emit('update:ready', value), { immediate: true })

// ── Camera ───────────────────────────────────────────────────────────────────
let openToken = 0

async function startCamera(): Promise<boolean> {
  if (cameraState.value === 'live') return true
  if (cameraState.value === 'opening') return false
  failure.value = null
  photoError.value = false
  if (!deps.isSecureContext()) { failure.value = 'insecure'; return false }
  cameraState.value = 'opening'
  const token = ++openToken
  let next: MediaStream
  try {
    next = await deps.openCamera(facing.value)
  } catch (err: unknown) {
    if (token !== openToken) return false
    failure.value = classifyCameraError(err)
    cameraState.value = 'off'
    return false
  }
  // Stopped (or left) while the camera was opening: never go live with this stream.
  if (token !== openToken || disposed || mode.value !== 'camera') {
    stopStream(next)
    if (token === openToken) cameraState.value = 'off'
    return false
  }
  stream.value = next
  cameraState.value = 'live'
  await nextTick()
  startPreview()
  return true
}

// The video lives inside the viewfinder, so attach the stream whenever both exist.
watch([videoRef, stream], () => {
  const video = videoRef.value
  const current = stream.value
  if (!video || !current || video.srcObject === current) return
  try {
    video.srcObject = current
    video.muted = true
    void Promise.resolve(video.play()).catch(() => { /* the autoplay attribute covers it */ })
  } catch {
    // Never keep a stream we cannot show.
    stopCamera()
    failure.value = 'other'
  }
}, { flush: 'post' })

function stopCamera() {
  openToken++
  stopPreview()
  stopStream(stream.value)
  stream.value = null
  if (videoRef.value) videoRef.value.srcObject = null
  if (cameraState.value !== 'off') cameraState.value = 'off'
}

async function flip() {
  if (busy.value) return
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  stopCamera()
  await startCamera()
}

function start() {
  if (busy.value || cameraState.value !== 'live') return
  session.startAll()
}

function startOver() {
  if (busy.value) return
  session.reset()
  void startCamera()
}

async function onSlot(index: number) {
  if (busy.value) return
  if (mode.value === 'gallery') { pickPhotos(index); return }
  if (await startCamera()) session.retake(index)
}

// Live preview: the same crop and filter math as the export, at low resolution.
let rafId = 0
function startPreview() { if (!rafId) rafId = requestAnimationFrame(drawPreview) }
function stopPreview() { if (rafId) cancelAnimationFrame(rafId); rafId = 0 }
function drawPreview() {
  rafId = 0
  if (!stream.value) return
  const video = videoRef.value
  const canvas = previewRef.value
  if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
    const win = activeWindow.value
    const k = PREVIEW_EDGE / Math.max(win.w, win.h)
    const w = Math.max(1, Math.round(win.w * k))
    const h = Math.max(1, Math.round(win.h * k))
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      const crop = coverCrop(video.videoWidth, video.videoHeight, w, h)
      ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h)
      if (filter.value !== 'normal') {
        const image = ctx.getImageData(0, 0, w, h)
        applyFilter(filter.value, image.data, w, h)
        ctx.putImageData(image, 0, 0)
      }
    }
  }
  rafId = requestAnimationFrame(drawPreview)
}

// ── Gallery fallback (photos never leave the device) ─────────────────────────
let pickTarget: number | null = null

function chooseGallery() {
  if (busy.value) return
  stopCamera()
  mode.value = 'gallery'
  failure.value = null
  pickPhotos(null)
}

function useCamera() {
  mode.value = 'camera'
  photoError.value = false
}

function pickPhotos(target: number | null) {
  pickTarget = target
  fileInput.value?.click()
}

async function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const target = pickTarget
  pickTarget = null
  input.value = ''
  if (!files.length) return
  photoError.value = false
  const empty = state.value.shots.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0)
  const slots = target !== null ? [target] : (empty.length ? empty : [0, 1, 2]).slice(0, files.length)
  for (let k = 0; k < slots.length; k++) {
    try {
      const bitmap = await deps.decodePhoto(files[k]!)
      if (disposed) { releaseShot(bitmap); return }
      session.setShot(slots[k]!, bitmap)
    } catch {
      photoError.value = true
    }
  }
}

// ── Export ───────────────────────────────────────────────────────────────────
/** The finished strip as a 1080×1920 PNG (never mirrored), or `null` until all 3 photos are in. */
async function renderPng(): Promise<Blob | null> {
  if (!ready.value) return null
  const canvas = document.createElement('canvas')
  canvas.width = BOOTH_WIDTH
  canvas.height = BOOTH_HEIGHT
  const scratch = createScratch()
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    composeStrip(ctx, { frame: props.frame, windows: props.windows, shots: state.value.shots, shotSize, filter: filter.value, makeScratch: scratch.make })
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  } finally {
    // The export canvases are released straight away; the shots stay for retakes and frame switches.
    releaseShot(canvas)
    scratch.release()
  }
}

defineExpose({ renderPng })

// ── Leaving ──────────────────────────────────────────────────────────────────
let hiddenTimer: ReturnType<typeof setTimeout> | null = null
function onVisibility() {
  if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null }
  if (document.visibilityState === 'hidden') hiddenTimer = setTimeout(stopCamera, HIDDEN_STOP_MS)
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', stopCamera)
})

onBeforeUnmount(() => {
  disposed = true
  session.dispose()
  stopCamera()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', stopCamera)
  if (hiddenTimer) clearTimeout(hiddenTimer)
  for (const shot of held) releaseShot(shot)
  held = []
})
</script>
