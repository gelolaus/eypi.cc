<template>
  <select
    :class="selectClasses"
    v-bind="attrsWithoutClass"
  >
    <slot />
  </select>
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
