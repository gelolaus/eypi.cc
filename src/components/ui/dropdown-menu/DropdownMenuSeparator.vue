<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DropdownMenuSeparator as RDropdownMenuSeparator, useForwardProps, type DropdownMenuSeparatorProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DropdownMenuSeparatorProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "-mx-1 my-1 h-px bg-border"
</script>

<template>
  <RDropdownMenuSeparator
    data-slot="dropdown-menu-separator"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDropdownMenuSeparator>
</template>
