<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DropdownMenuSubContent as RDropdownMenuSubContent, useForwardPropsEmits, type DropdownMenuSubContentProps, type DropdownMenuSubContentEmits } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DropdownMenuSubContentProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const emits = defineEmits<DropdownMenuSubContentEmits>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "z-50 min-w-[96px] origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
</script>

<template>
  <RDropdownMenuSubContent
    data-slot="dropdown-menu-sub-content"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDropdownMenuSubContent>
</template>
