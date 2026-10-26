<script setup lang="ts">
import { computed } from 'vue'
import { DialogTrigger as RDialogTrigger, useForwardProps, type DialogTriggerProps } from 'reka-ui'

interface Props extends DialogTriggerProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RDialogTrigger
    data-slot="dialog-trigger"
    
    v-bind="forwarded"
  >
    <slot />
  </RDialogTrigger>
</template>
