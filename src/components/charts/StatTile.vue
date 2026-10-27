<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string; value: string; delta?: number | null }>()
const rounded = computed(() => {
  const d = props.delta
  return d == null || !Number.isFinite(d) ? null : Math.round(d)
})
const deltaText = computed(() => {
  const r = rounded.value
  if (r === null) return ''
  return `${r > 0 ? '+' : r < 0 ? '\u2212' : ''}${Math.abs(r)}%`
})
const arrow = computed(() => ((rounded.value ?? 0) > 0 ? '\u25B2' : (rounded.value ?? 0) < 0 ? '\u25BC' : ''))
const wording = computed(() => ((rounded.value ?? 0) > 0 ? 'increase versus previous period' : (rounded.value ?? 0) < 0 ? 'decrease versus previous period' : ''))
</script>

<template>
  <div class="rounded-2xl border bg-card p-4">
    <p class="text-sm text-muted-foreground">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold tabular-nums">{{ value }}</p>
    <p v-if="deltaText" class="mt-1 text-sm text-muted-foreground" data-testid="delta">
      <span aria-hidden="true">{{ arrow }}</span>
      {{ deltaText }}
      <span v-if="wording" class="sr-only">{{ wording }}</span>
    </p>
  </div>
</template>
