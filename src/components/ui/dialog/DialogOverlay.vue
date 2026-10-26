<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DialogOverlay as RDialogOverlay, useForwardProps, type DialogOverlayProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DialogOverlayProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
</script>

<template>
  <RDialogOverlay
    data-slot="dialog-overlay"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDialogOverlay>
</template>
