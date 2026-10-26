<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import {
  SelectIcon as RSelectIcon,
  SelectTrigger as RSelectTrigger,
  useForwardProps,
  type SelectTriggerProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends SelectTriggerProps {
  class?: HTMLAttributes['class']
  size?: 'sm' | 'default'
}

const props = withDefaults(defineProps<Props>(), { size: 'default' })
const delegated = computed(() => {
  const { class: _class, size: _size, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "flex w-fit items-center justify-between gap-1.5 rounded-xl border border-input bg-transparent py-2 pr-2 pl-3 text-base whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-11 data-[size=sm]:h-9 data-[size=sm]:rounded-lg data-[size=sm]:text-sm *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
</script>

<template>
  <RSelectTrigger
    data-slot="select-trigger"
    :data-size="props.size"
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
    <RSelectIcon as-child>
      <ChevronDown class="pointer-events-none size-4 text-muted-foreground" />
    </RSelectIcon>
  </RSelectTrigger>
</template>
