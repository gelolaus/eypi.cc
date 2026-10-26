<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuPortal as RDropdownMenuPortal, useForwardProps, type DropdownMenuPortalProps } from 'reka-ui'

interface Props extends DropdownMenuPortalProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RDropdownMenuPortal
    
    
    v-bind="forwarded"
  >
    <slot />
  </RDropdownMenuPortal>
</template>
