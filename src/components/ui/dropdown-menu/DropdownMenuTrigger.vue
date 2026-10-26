<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuTrigger as RDropdownMenuTrigger, useForwardProps, type DropdownMenuTriggerProps } from 'reka-ui'

interface Props extends DropdownMenuTriggerProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RDropdownMenuTrigger
    data-slot="dropdown-menu-trigger"
    
    v-bind="forwarded"
    
  >
    <slot />
  </RDropdownMenuTrigger>
</template>
