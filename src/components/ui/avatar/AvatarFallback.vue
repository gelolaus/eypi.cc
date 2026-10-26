<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { AvatarFallback as AvatarFallbackPrimitive, type AvatarFallbackProps } from 'reka-ui'
import { cn } from '@/lib/cn'

const props = defineProps<AvatarFallbackProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <AvatarFallbackPrimitive
    data-slot="avatar-fallback"
    :delay-ms="props.delayMs"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
        props.class,
      )
    "
  >
    <slot />
  </AvatarFallbackPrimitive>
</template>
