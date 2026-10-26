<script setup lang="ts">
import { SelectRoot as RSelectRoot, useForwardPropsEmits, type SelectRootProps, type SelectRootEmits } from 'reka-ui'

const props = defineProps<SelectRootProps>()
const emits = defineEmits<SelectRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RSelectRoot v-bind="forwarded">
    <slot />
  </RSelectRoot>
</template>
