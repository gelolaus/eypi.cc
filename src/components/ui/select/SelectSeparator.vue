<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { SelectSeparator as RSelectSeparator, useForwardProps, type SelectSeparatorProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends SelectSeparatorProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "pointer-events-none -mx-1 my-1 h-px bg-border"
</script>

<template>
  <RSelectSeparator
    data-slot="select-separator"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RSelectSeparator>
</template>
