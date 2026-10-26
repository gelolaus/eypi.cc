<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { SelectLabel as RSelectLabel, useForwardProps, type SelectLabelProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends SelectLabelProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "px-1.5 py-1 text-xs text-muted-foreground"
</script>

<template>
  <RSelectLabel
    data-slot="select-label"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RSelectLabel>
</template>
