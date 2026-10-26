<script setup lang="ts">
import { computed } from 'vue'
import { TooltipTrigger as RTooltipTrigger, useForwardProps, type TooltipTriggerProps } from 'reka-ui'

interface Props extends TooltipTriggerProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RTooltipTrigger
    data-slot="tooltip-trigger"
    
    v-bind="forwarded"
  >
    <slot />
  </RTooltipTrigger>
</template>
