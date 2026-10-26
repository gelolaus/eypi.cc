<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DropdownMenuSubTrigger as RDropdownMenuSubTrigger, useForwardProps, type DropdownMenuSubTriggerProps } from 'reka-ui'
import { cn } from '@/lib/cn'
import { ChevronRight } from 'lucide-vue-next'

interface Props extends DropdownMenuSubTriggerProps {
  class?: HTMLAttributes['class']
  inset?: boolean
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, inset: _inset, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
</script>

<template>
  <RDropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    :data-inset="props.inset || undefined"
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
    <ChevronRight class="ml-auto" />
  </RDropdownMenuSubTrigger>
</template>
