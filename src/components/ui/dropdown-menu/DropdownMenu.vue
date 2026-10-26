<script setup lang="ts">
import { DropdownMenuRoot as RDropdownMenuRoot, useForwardPropsEmits, type DropdownMenuRootProps, type DropdownMenuRootEmits } from 'reka-ui'

const props = defineProps<DropdownMenuRootProps>()
const emits = defineEmits<DropdownMenuRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RDropdownMenuRoot v-bind="forwarded">
    <slot />
  </RDropdownMenuRoot>
</template>
