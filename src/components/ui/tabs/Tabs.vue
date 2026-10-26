<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { TabsRoot as RTabsRoot, useForwardPropsEmits, type TabsRootProps, type TabsRootEmits } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends TabsRootProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { orientation: 'horizontal' })
const emits = defineEmits<TabsRootEmits>()
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
const forwarded = useForwardPropsEmits(delegated, emits)
const base = "group/tabs flex gap-2 data-horizontal:flex-col data-[orientation=horizontal]:flex-col"
</script>

<template>
  <RTabsRoot
    data-slot="tabs"
    
    v-bind="forwarded"
    :class="cn(base, props.class)"
  >
    <slot />
  </RTabsRoot>
</template>
