<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/cn'

const sizes = {
  sm: { row: 'gap-1.5 text-xs font-medium', mark: 'size-5' },
  md: { row: 'gap-2.5 text-xl font-semibold tracking-tight', mark: 'size-8' },
  lg: {
    row: 'font-display gap-3 text-5xl font-semibold tracking-tight sm:text-6xl',
    mark: 'size-14 sm:size-16',
  },
} as const

const props = withDefaults(
  defineProps<{ to?: string; size?: keyof typeof sizes; markOnly?: boolean }>(),
  { size: 'md', markOnly: false },
)

const markSrc = '/favicon.svg'
const s = computed(() => sizes[props.size])
const rowClass = computed(() => cn('inline-flex items-center', s.value.row))
</script>

<template>
  <router-link
    v-if="to"
    :to="to"
    :class="rowClass"
    aria-label="eypi.cc"
  >
    <img
      :src="markSrc"
      alt=""
      :class="cn('shrink-0 rounded-md object-cover', s.mark)"
    >
    <span v-if="!markOnly">eypi.cc</span>
  </router-link>
  <span
    v-else
    :class="rowClass"
    :aria-label="markOnly ? 'eypi.cc' : undefined"
  >
    <img
      :src="markSrc"
      alt=""
      :class="cn('shrink-0 rounded-md object-cover', s.mark)"
    >
    <span v-if="!markOnly">eypi.cc</span>
  </span>
</template>
