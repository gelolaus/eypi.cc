<template>
  <div
    aria-hidden="true"
    class="max-w-full bg-muted motion-safe:animate-pulse"
    :style="{ width: toCss(w), height: toCss(h), borderRadius: toCss(radius) }"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{ w?: number | string; h: number; radius?: number }>(), {
  w: '100%',
  radius: 12,
})

function toCss(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value
}
</script>
