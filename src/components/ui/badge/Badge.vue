<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { cn } from '@/lib/cn'
import { badgeVariants, type BadgeVariants } from './index'

interface Props extends PrimitiveProps {
  variant?: BadgeVariants['variant']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { as: 'span', variant: 'default' })
</script>

<template>
  <Primitive
    data-slot="badge"
    :data-variant="props.variant"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn(badgeVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </Primitive>
</template>
