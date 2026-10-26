<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { SelectScrollDownButton as RSelectScrollDownButton, useForwardProps, type SelectScrollDownButtonProps } from 'reka-ui'
import { cn } from '@/lib/cn'
import { ChevronDown } from 'lucide-vue-next'

interface Props extends SelectScrollDownButtonProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4"
</script>

<template>
  <RSelectScrollDownButton
    data-slot="select-scroll-down-button"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot>
      <ChevronDown />
    </slot>
  </RSelectScrollDownButton>
</template>
