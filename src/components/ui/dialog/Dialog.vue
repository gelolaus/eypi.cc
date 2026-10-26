<script setup lang="ts">
import { DialogRoot as RDialogRoot, useForwardPropsEmits, type DialogRootProps, type DialogRootEmits } from 'reka-ui'

const props = defineProps<DialogRootProps>()
const emits = defineEmits<DialogRootEmits>()
const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RDialogRoot v-bind="forwarded">
    <slot />
  </RDialogRoot>
</template>
