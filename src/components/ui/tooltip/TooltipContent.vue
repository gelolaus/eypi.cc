<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import {
  TooltipArrow as RTooltipArrow,
  TooltipContent as RTooltipContent,
  TooltipPortal as RTooltipPortal,
  useForwardPropsEmits,
  type TooltipContentEmits,
  type TooltipContentProps,
} from 'reka-ui'
import { cn } from '@/lib/cn'

defineOptions({ inheritAttrs: false })

interface Props extends TooltipContentProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { sideOffset: 0 })
const emits = defineEmits<TooltipContentEmits>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "z-50 inline-flex w-fit max-w-xs origin-(--reka-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
</script>

<template>
  <RTooltipPortal>
    <RTooltipContent data-slot="tooltip-content" v-bind="{ ...forwarded, ...$attrs }" :class="cn(base, props.class)">
      <slot />
      <RTooltipArrow
        class="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground"
      />
    </RTooltipContent>
  </RTooltipPortal>
</template>
