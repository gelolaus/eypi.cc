<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Separator as SeparatorPrimitive, type SeparatorProps } from 'reka-ui'
import { cn } from '@/lib/cn'

const props = withDefaults(defineProps<SeparatorProps & { class?: HTMLAttributes['class'] }>(), {
  orientation: 'horizontal',
  decorative: true,
})
</script>

<template>
  <SeparatorPrimitive
    data-slot="separator"
    :decorative="props.decorative"
    :orientation="props.orientation"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        'shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
        props.class,
      )
    "
  />
</template>
