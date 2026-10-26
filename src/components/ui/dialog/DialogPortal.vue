<script setup lang="ts">
import { computed } from 'vue'
import { DialogPortal as RDialogPortal, useForwardProps, type DialogPortalProps } from 'reka-ui'

interface Props extends DialogPortalProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RDialogPortal
    
    
    v-bind="forwarded"
  >
    <slot />
  </RDialogPortal>
</template>
