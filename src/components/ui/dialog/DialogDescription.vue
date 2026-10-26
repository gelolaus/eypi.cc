<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { DialogDescription as RDialogDescription, useForwardProps, type DialogDescriptionProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends DialogDescriptionProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground"
</script>

<template>
  <RDialogDescription
    data-slot="dialog-description"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RDialogDescription>
</template>
