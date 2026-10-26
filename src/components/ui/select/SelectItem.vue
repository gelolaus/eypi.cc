<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { SelectItem as RSelectItem, useForwardProps, type SelectItemProps } from 'reka-ui'
import { cn } from '@/lib/cn'
import { Check } from 'lucide-vue-next'
import { SelectItemIndicator, SelectItemText } from 'reka-ui'

interface Props extends SelectItemProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
</script>

<template>
  <RSelectItem
    data-slot="select-item"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
      <SelectItemIndicator>
        <Check class="pointer-events-none" />
      </SelectItemIndicator>
    </span>
    <SelectItemText>
      <slot />
    </SelectItemText>
  </RSelectItem>
</template>
