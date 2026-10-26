<script setup lang="ts">
import { computed } from 'vue'
import { TooltipProvider as RTooltipProvider, useForwardProps, type TooltipProviderProps } from 'reka-ui'

interface Props extends TooltipProviderProps {
  
}

const props = withDefaults(defineProps<Props>(), { delayDuration: 0 })
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RTooltipProvider
    
    
    v-bind="forwarded"
  >
    <slot />
  </RTooltipProvider>
</template>
