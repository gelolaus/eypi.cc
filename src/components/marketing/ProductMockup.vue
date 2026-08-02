<template>
  <div class="flex flex-col items-center gap-5">
    <div
      class="w-[280px] overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl sm:w-[300px]"
      :class="{ 'mock-enter': animateEnter }"
    >
      <div
        class="flex h-[560px] flex-col bg-g-bg px-4 pb-6 pt-5 transition-colors duration-300 sm:h-[580px]"
      >
        <!-- Status bar -->
        <div class="mb-5 flex items-center justify-between px-1 text-[10px] font-medium text-g-muted">
          <span>9:41</span>
          <span class="mx-auto h-5 w-20 rounded-full bg-neutral-900" aria-hidden="true" />
          <span>100%</span>
        </div>

        <p class="mb-3 text-eyebrow">Short link</p>

        <!-- Sample short-link card -->
        <div
          class="rounded-2xl border border-g-border bg-g-surface p-4 shadow-sm transition-[box-shadow,border-color] duration-300"
          :style="{ boxShadow: `0 8px 24px color-mix(in srgb, ${accent} 18%, transparent)` }"
        >
          <div class="mb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-display text-lg font-semibold tracking-tight text-g-text">
                eypi.cc/demo
              </p>
              <p class="mt-1 truncate text-sm text-g-muted">
                → example.edu/events/orientation
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
              :style="{
                backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`,
                color: accent,
              }"
            >
              Active
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-xl border border-g-border bg-g-bg/60 px-3 py-2.5">
              <p class="text-[11px] uppercase tracking-wide text-g-muted">Clicks</p>
              <p class="mt-0.5 font-display text-xl font-semibold text-g-text">248</p>
            </div>
            <div class="rounded-xl border border-g-border bg-g-bg/60 px-3 py-2.5">
              <p class="text-[11px] uppercase tracking-wide text-g-muted">QR scans</p>
              <p class="mt-0.5 font-display text-xl font-semibold text-g-text">64</p>
            </div>
          </div>

          <div
            class="mt-3 flex h-10 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300"
            :style="{ backgroundColor: accent, color: accentFg }"
          >
            Copy link
          </div>
        </div>

        <div class="mt-4 space-y-2">
          <div class="h-3 w-4/5 rounded-full bg-g-border/80" />
          <div class="h-3 w-3/5 rounded-full bg-g-border/60" />
        </div>
      </div>
    </div>

    <!-- Optional accent swatches (gold / blue) -->
    <div class="flex items-center gap-2" role="group" aria-label="Accent color">
      <button
        v-for="swatch in swatches"
        :key="swatch.id"
        type="button"
        :aria-label="`${swatch.label} accent`"
        :aria-pressed="accent === swatch.color"
        class="size-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        :style="{
          backgroundColor: swatch.color,
          borderColor: accent === swatch.color ? 'var(--color-text)' : 'transparent',
        }"
        @click="accent = swatch.color"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const swatches = [
  { id: 'gold', label: 'Gold', color: '#DEAC4B' },
  { id: 'blue', label: 'Blue', color: '#34418F' },
] as const

const accent = ref<string>(swatches[0].color)
const animateEnter = ref(false)

const accentFg = computed(() => (accent.value === '#DEAC4B' ? '#1A1408' : '#F5F1EA'))

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced) {
    requestAnimationFrame(() => {
      animateEnter.value = true
    })
  } else {
    animateEnter.value = true
  }
})
</script>

<style scoped>
.mock-enter {
  animation: mock-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes mock-rise {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mock-enter {
    animation: none;
  }
}
</style>
