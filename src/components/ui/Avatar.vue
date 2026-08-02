<template>
  <span
    :class="
      cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-g-brand/15 text-sm font-semibold text-g-brand',
        className,
      )
    "
    :aria-label="name"
    role="img"
  >
    <img
      v-if="src && !imgFailed"
      :src="src"
      :alt="name"
      class="h-full w-full object-cover"
      @error="imgFailed = true"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cn } from '@/lib/cn'

const props = defineProps<{
  src?: string
  name: string
  className?: string
}>()

const imgFailed = ref(false)

watch(
  () => props.src,
  () => {
    imgFailed.value = false
  },
)

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})
</script>
