<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DialogTitle as RDialogTitle, useForwardProps, type DialogTitleProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DialogTitleProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "font-heading text-base leading-none font-medium"
</script>

<template>
  <RDialogTitle
    data-slot="dialog-title"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDialogTitle>
</template>
