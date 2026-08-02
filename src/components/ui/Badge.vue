<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'

export type BadgeTone = 'default' | 'brand' | 'success' | 'danger'

const props = withDefaults(
  defineProps<{
    tone?: BadgeTone
    className?: string
  }>(),
  { tone: 'default' },
)

const toneClass: Record<BadgeTone, string> = {
  default: 'border border-g-border bg-g-bg text-g-muted',
  brand: 'border border-transparent bg-g-brand/15 text-g-brand',
  success: 'border border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  danger: 'border border-transparent bg-g-destructive/15 text-g-destructive',
}

const badgeClasses = computed(() =>
  cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
    toneClass[props.tone],
    props.className,
  ),
)
</script>
