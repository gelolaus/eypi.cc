<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { SelectGroup as RSelectGroup, useForwardProps, type SelectGroupProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends SelectGroupProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "scroll-my-1 p-1"
</script>

<template>
  <RSelectGroup
    data-slot="select-group"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RSelectGroup>
</template>
