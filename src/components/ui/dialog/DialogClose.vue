<script setup lang="ts">
import { computed } from 'vue'
import { DialogClose as RDialogClose, useForwardProps, type DialogCloseProps } from 'reka-ui'

interface Props extends DialogCloseProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RDialogClose
    data-slot="dialog-close"
    
    v-bind="forwarded"
  >
    <slot />
  </RDialogClose>
</template>
