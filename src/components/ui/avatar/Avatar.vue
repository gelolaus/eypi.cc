<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { AvatarRoot, type AvatarRootProps } from 'reka-ui'
import { cn } from '@/lib/cn'

interface Props extends AvatarRootProps {
  size?: 'default' | 'sm' | 'lg'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), { size: 'default' })
</script>

<template>
  <AvatarRoot
    data-slot="avatar"
    :data-size="props.size"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
'group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6',
        props.class,
      )
    "
  >
    <slot />
  </AvatarRoot>
</template>
