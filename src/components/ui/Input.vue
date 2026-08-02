<template>
  <input
    :class="fieldClasses(className)"
    v-bind="attrsWithoutClass"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { fieldClasses } from '@/lib/ui/fieldClasses'

defineOptions({ inheritAttrs: false })

defineProps<{
  className?: string
}>()

const attrs = useAttrs()
const attrsWithoutClass = computed(() => {
  const { class: _c, ...rest } = attrs as Record<string, unknown>
  return rest
})
</script>
