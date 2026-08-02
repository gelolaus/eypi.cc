<template>
  <div :class="cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)">
    <h3 class="font-display text-lg font-semibold text-g-text">{{ title }}</h3>
    <p v-if="description" class="max-w-sm text-sm text-g-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{
  title: string
  description?: string
  className?: string
}>()
</script>
