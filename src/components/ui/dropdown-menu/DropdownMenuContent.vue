<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  DropdownMenuContent as RDropdownMenuContent,
  DropdownMenuPortal as RDropdownMenuPortal,
  useForwardPropsEmits,
  type DropdownMenuContentEmits,
  type DropdownMenuContentProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'

defineOptions({ inheritAttrs: false })

interface Props extends DropdownMenuContentProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { align: 'start', sideOffset: 4 })
const emits = defineEmits<DropdownMenuContentEmits>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "z-50 max-h-(--reka-dropdown-menu-content-available-height) w-(--reka-dropdown-menu-trigger-width) min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
</script>

<template>
  <RDropdownMenuPortal>
    <RDropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn(base, props.class)"
    >
      <slot />
    </RDropdownMenuContent>
  </RDropdownMenuPortal>
</template>
