<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string; value: string; delta?: number | null }>()
const deltaText = computed(() => {
  const d = props.delta
  if (d == null || !Number.isFinite(d)) return ''
  const n = Math.round(Math.abs(d))
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${n}%`
})
const arrow = computed(() => ((props.delta ?? 0) > 0 ? '▲' : (props.delta ?? 0) < 0 ? '▼' : ''))
</script>

<template>
  <div class="rounded-2xl border bg-card p-4">
    <p class="text-sm text-muted-foreground">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold tabular-nums">{{ value }}</p>
    <p v-if="deltaText" class="mt-1 text-sm text-muted-foreground" data-testid="delta">
      <span aria-hidden="true">{{ arrow }}</span>
      {{ deltaText }}
      <span class="sr-only">{{ (delta ?? 0) < 0 ? 'decrease' : (delta ?? 0) > 0 ? 'increase' : 'no change' }} versus previous period</span>
    </p>
  </div>
</template>
