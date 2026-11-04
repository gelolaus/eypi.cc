<template>
  <!-- Strip review: the composed strip, with a button over each window to retake or replace it -->
  <div
    data-booth-strip
    class="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-muted"
    :style="{ aspectRatio: `${BOOTH_WIDTH} / ${BOOTH_HEIGHT}` }"
  >
    <canvas
      ref="canvasRef"
      :width="BOOTH_WIDTH"
      :height="BOOTH_HEIGHT"
      role="img"
      :aria-label="shots.every(Boolean) ? 'Your photo strip' : 'Your photo strip, not finished yet'"
      class="absolute inset-0 h-full w-full"
    />
    <button
      v-for="(win, i) in windows"
      :key="i"
      type="button"
      class="absolute rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
      :style="windowStyle(win)"
      :aria-label="slotLabel(i)"
      :disabled="disabled"
      @click="emit('select', i)"
    >
      <span
        aria-hidden="true"
        class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground"
      >
        {{ mode === 'camera' ? 'Retake' : shots[i] ? 'Replace' : 'Add photo' }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { composeStrip } from '@/lib/booth/compose'
import type { BoothFilterId } from '@/lib/booth/filters'
import { createScratch, shotSize } from '@/lib/booth/capture'
import { BOOTH_HEIGHT, BOOTH_WIDTH, type BoothWindow } from '@shared/boothWindows'

const props = defineProps<{
  frame: HTMLImageElement
  windows: BoothWindow[]
  shots: (CanvasImageSource | null)[]
  filter: BoothFilterId
  mode: 'camera' | 'gallery'
  disabled?: boolean
}>()
const emit = defineEmits<{ select: [index: number] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const scratch = createScratch()

function windowStyle(win: BoothWindow) {
  return {
    left: `${(win.x / BOOTH_WIDTH) * 100}%`,
    top: `${(win.y / BOOTH_HEIGHT) * 100}%`,
    width: `${(win.w / BOOTH_WIDTH) * 100}%`,
    height: `${(win.h / BOOTH_HEIGHT) * 100}%`,
  }
}

function slotLabel(i: number) {
  if (props.mode === 'camera') return `Retake shot ${i + 1}`
  return props.shots[i] ? `Replace photo ${i + 1}` : `Choose photo ${i + 1}`
}

function draw() {
  const ctx = canvasRef.value?.getContext('2d')
  if (!ctx) return
  composeStrip(ctx, { frame: props.frame, windows: props.windows, shots: props.shots, shotSize, filter: props.filter, makeScratch: scratch.make })
}

watch([canvasRef, () => props.frame, () => props.windows, () => props.shots, () => props.filter], draw, { flush: 'post' })

onBeforeUnmount(() => scratch.release())
</script>
