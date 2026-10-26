<script setup lang="ts">
import { computed } from 'vue'
import { SelectValue as RSelectValue, useForwardProps, type SelectValueProps } from 'reka-ui'

interface Props extends SelectValueProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RSelectValue
    data-slot="select-value"
    
    v-bind="forwarded"
  >
    <slot />
  </RSelectValue>
</template>
