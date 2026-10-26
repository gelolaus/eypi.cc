<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DropdownMenuRadioItem as RDropdownMenuRadioItem, useForwardPropsEmits, type DropdownMenuRadioItemProps, type DropdownMenuRadioItemEmits } from 'reka-ui'
import { cn } from '@/lib/cn'
import { Check } from 'lucide-vue-next'
import { DropdownMenuItemIndicator } from 'reka-ui'

interface Props extends DropdownMenuRadioItemProps {
  class?: HTMLAttributes['class']
  inset?: boolean
}

const props = defineProps<Props>()
const emits = defineEmits<DropdownMenuRadioItemEmits>()
const delegated = computed(() => {
  const { class: _class, inset: _inset, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
</script>

<template>
  <RDropdownMenuRadioItem
    data-slot="dropdown-menu-radio-item"
    :data-inset="props.inset || undefined"
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <span
      class="pointer-events-none absolute right-2 flex items-center justify-center"
      data-slot="dropdown-menu-radio-item-indicator"
    >
      <DropdownMenuItemIndicator>
        <Check />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </RDropdownMenuRadioItem>
</template>
