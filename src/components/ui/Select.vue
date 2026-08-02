<template>
  <div class="relative">
    <select
      :class="selectClasses"
      v-bind="attrsWithoutClass"
    >
      <slot />
    </select>
    <svg
      class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-g-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/cn'
import { fieldClasses } from '@/lib/ui/fieldClasses'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  className?: string
}>()

const attrs = useAttrs()
const attrsWithoutClass = computed(() => {
  const { class: _c, ...rest } = attrs as Record<string, unknown>
  return rest
})

const selectClasses = computed(() =>
  cn(fieldClasses(), 'appearance-none pr-10', props.className),
)
</script>
