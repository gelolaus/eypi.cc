<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { SelectScrollUpButton as RSelectScrollUpButton, useForwardProps, type SelectScrollUpButtonProps } from 'reka-ui'
import { cn } from '@/lib/cn'
import { ChevronUp } from 'lucide-vue-next'

interface Props extends SelectScrollUpButtonProps {
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
  <RSelectScrollUpButton
    data-slot="select-scroll-up-button"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot>
      <ChevronUp />
    </slot>
  </RSelectScrollUpButton>
</template>
