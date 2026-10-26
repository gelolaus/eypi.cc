<script setup lang="ts">
import { TooltipRoot as RTooltipRoot, useForwardPropsEmits, type TooltipRootProps, type TooltipRootEmits } from 'reka-ui'

const props = defineProps<TooltipRootProps>()
const emits = defineEmits<TooltipRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RTooltipRoot v-bind="forwarded">
    <slot />
  </RTooltipRoot>
</template>
