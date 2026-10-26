<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { TabsList as RTabsList, useForwardProps, type TabsListProps } from 'reka-ui'
import { cn } from '@/lib/cn'
import { tabsListVariants, type TabsListVariants } from './index'

interface Props extends TabsListProps {
  class?: HTMLAttributes['class']
  variant?: TabsListVariants['variant']
}

const props = withDefaults(defineProps<Props>(), { variant: 'default' })
const delegated = computed(() => {
  const { class: _class, variant: _variant, ...rest } = props
  return rest
})
const forwarded = useForwardProps(delegated)
</script>

<template>
  <RTabsList
    data-slot="tabs-list"
    :data-variant="props.variant"
    v-bind="forwarded"
    :class="cn(tabsListVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </RTabsList>
</template>
