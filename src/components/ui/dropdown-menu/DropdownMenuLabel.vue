<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DropdownMenuLabel as RDropdownMenuLabel, useForwardProps, type DropdownMenuLabelProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DropdownMenuLabelProps {
  class?: HTMLAttributes['class']
  inset?: boolean
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, inset: _inset, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7"
</script>

<template>
  <RDropdownMenuLabel
    data-slot="dropdown-menu-label"
    :data-inset="props.inset || undefined"
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDropdownMenuLabel>
</template>
