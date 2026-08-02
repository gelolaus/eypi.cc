<template>
  <div :class="cn('rounded-2xl border border-g-border bg-g-surface p-7 md:p-8', className)">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/cn'

defineProps<{ className?: string }>()
</script>
