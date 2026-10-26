<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { AvatarImage as AvatarImagePrimitive, type AvatarImageProps } from 'reka-ui'
import { cn } from '@/lib/cn'

const props = defineProps<AvatarImageProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <AvatarImagePrimitive
    data-slot="avatar-image"
    :src="props.src"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('aspect-square size-full rounded-full object-cover', props.class)"
  >
    <slot />
  </AvatarImagePrimitive>
</template>
