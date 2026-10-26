<script setup lang="ts">
import { DropdownMenuSub as RDropdownMenuSub, useForwardPropsEmits, type DropdownMenuSubProps, type DropdownMenuSubEmits } from 'reka-ui'

const props = defineProps<DropdownMenuSubProps>()
const emits = defineEmits<DropdownMenuSubEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RDropdownMenuSub v-bind="forwarded">
    <slot />
  </RDropdownMenuSub>
</template>
