<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Label as LabelPrimitive, type LabelProps } from 'reka-ui'
import { cn } from '@/lib/cn'

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <LabelPrimitive
    data-slot="label"
    :for="props.for"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        'flex items-center gap-2 text-base leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </LabelPrimitive>
</template>
