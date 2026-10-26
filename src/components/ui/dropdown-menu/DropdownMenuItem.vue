<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DropdownMenuItem as RDropdownMenuItem, useForwardPropsEmits, type DropdownMenuItemProps, type DropdownMenuItemEmits } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DropdownMenuItemProps {
  class?: HTMLAttributes['class']
  inset?: boolean
  variant?: 'default' | 'destructive'
}

const props = withDefaults(defineProps<Props>(), { variant: 'default' })
const emits = defineEmits<DropdownMenuItemEmits>()
const delegated = computed(() => {
  const { class: _class, inset: _inset, variant: _variant, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive"
</script>

<template>
  <RDropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-inset="props.inset || undefined"
    :data-variant="props.variant"
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDropdownMenuItem>
</template>
