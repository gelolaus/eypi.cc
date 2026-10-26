<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { TabsContent as RTabsContent, useForwardProps, type TabsContentProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends TabsContentProps {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
const base = "flex-1 text-sm outline-none"
</script>

<template>
  <RTabsContent
    data-slot="tabs-content"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RTabsContent>
</template>
