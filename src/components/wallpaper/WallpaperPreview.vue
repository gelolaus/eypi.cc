<template>
  <div class="mx-auto w-full max-w-[320px]">
    <canvas
      ref="canvas"
      role="img"
      :aria-label="description"
      class="block h-auto w-full rounded-3xl border border-border bg-muted"
      :style="{ aspectRatio: `${input.width} / ${input.height}` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { groupDays } from '@shared/schedule/layout'
import { formatRange } from '@/lib/wallpaper/format'
import { render } from '@/lib/wallpaper/render'
import type { RenderInput } from '@/lib/wallpaper/types'

const props = defineProps<{ input: RenderInput }>()

/** The preview is drawn at this width at most; the download is drawn at full size by the same code. */
const PREVIEW_WIDTH = 540

const canvas = ref<HTMLCanvasElement | null>(null)
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
  const scale = Math.min(1, PREVIEW_WIDTH / width)
  void render(canvas.value, { ...props.input, width: Math.round(width * scale), height: Math.round(height * scale) })
}

function schedule() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(draw)
}

onMounted(draw)
watch(() => props.input, schedule, { deep: true })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
