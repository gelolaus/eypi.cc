<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuGroup as RDropdownMenuGroup, useForwardProps, type DropdownMenuGroupProps } from 'reka-ui'

interface Props extends DropdownMenuGroupProps {
  
}

const props = defineProps<Props>()
const delegated = computed(() => ({ ...props }))
const forwarded = useForwardProps(delegated)

</script>

<template>
  <RDropdownMenuGroup
    data-slot="dropdown-menu-group"
    
    v-bind="forwarded"
  >
    <slot />
  </RDropdownMenuGroup>
</template>
