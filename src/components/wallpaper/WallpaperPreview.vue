<template>
  <div :class="['mx-auto w-full', landscape ? 'max-w-[640px]' : 'max-w-[320px]']">
    <canvas
      ref="canvas"
      role="img"
      :aria-label="description"
      :class="['mx-auto block h-auto w-[min(100%,calc(var(--preview-max-h,100dvh)*var(--preview-ratio)))] border border-border bg-muted', landscape ? 'rounded-lg' : 'rounded-3xl']"
      :style="{ aspectRatio: `${input.width} / ${input.height}`, '--preview-ratio': input.width / input.height }"
    />
    <p
      v-if="failed"
      role="alert"
      class="mt-2 text-center text-sm text-destructive"
    >
      Could not draw the preview.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { groupDays } from '@shared/schedule/layout'
import { formatRange } from '@/lib/wallpaper/format'
import { render } from '@/lib/wallpaper/render'
import { isLandscape } from '@/lib/wallpaper/safeZone'
import type { RenderInput } from '@/lib/wallpaper/types'

const props = defineProps<{ input: RenderInput }>()

/** The preview is drawn at this width at most; the download is drawn at full size by the same code. A landscape screen gets more, since its text is sized from the height. */
const PREVIEW_WIDTH = 540
const LANDSCAPE_PREVIEW_WIDTH = 960

const canvas = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const landscape = computed(() => isLandscape(props.input.width, props.input.height))
let frame = 0

const description = computed(() => {
  const groups = groupDays(props.input.schedule)
  if (groups.length === 0) return 'Wallpaper preview. No classes to show.'
  const days = groups.map((group) => {
    const classes = group.entries.map((entry) => `${entry.code} ${entry.async ? 'async' : formatRange(entry.start, entry.end)}`)
    return `${group.label}: ${classes.join(', ')}`
  })
  return `Wallpaper preview. ${days.join('. ')}.`
})

function draw() {
  if (!canvas.value) return
  const { width, height } = props.input
  const scale = Math.min(1, (landscape.value ? LANDSCAPE_PREVIEW_WIDTH : PREVIEW_WIDTH) / width)
  render(canvas.value, { ...props.input, width: Math.round(width * scale), height: Math.round(height * scale) })
    .then(() => { failed.value = false })
    .catch(() => { failed.value = true })
}

function schedule() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(draw)
}

onMounted(draw)
watch(() => props.input, schedule, { deep: true })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
