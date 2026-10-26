<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuRadioGroup as RDropdownMenuRadioGroup, useForwardPropsEmits, type DropdownMenuRadioGroupProps, type DropdownMenuRadioGroupEmits } from 'reka-ui'

interface Props extends DropdownMenuRadioGroupProps {
  
}

const props = defineProps<Props>()
const emits = defineEmits<DropdownMenuRadioGroupEmits>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardPropsEmits(delegated, emits)

</script>

<template>
  <RDropdownMenuRadioGroup
    data-slot="dropdown-menu-radio-group"
    
    v-bind="forwarded"
  >
    <slot />
  </RDropdownMenuRadioGroup>
</template>
