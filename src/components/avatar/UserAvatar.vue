<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { isAvatarColor, isAvatarIcon } from '@shared/avatars'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { AVATAR_ICON_COMPONENTS } from './avatarIcons'

const props = defineProps<{
  name: string
  icon?: string | null
  color?: string | null
  class?: HTMLAttributes['class']
}>()

const initials = computed(() => Array.from(props.name.trim()).slice(0, 2).join('').toUpperCase() || '?')

/** The chosen pair, or null when either half is missing or unknown (initials show instead). */
const chosen = computed(() =>
  isAvatarIcon(props.icon) && isAvatarColor(props.color)
    ? { icon: AVATAR_ICON_COMPONENTS[props.icon], color: props.color }
    : null,
)
</script>

<template>
  <span
    v-if="chosen"
    :class="cn('relative flex size-8 shrink-0 items-center justify-center rounded-full select-none', props.class)"
    :style="{
      color: `var(--avatar-${chosen.color})`,
      backgroundColor: `color-mix(in srgb, var(--avatar-${chosen.color}) 15%, transparent)`,
    }"
  >
    <component :is="chosen.icon" class="size-[55%]" aria-hidden="true" />
  </span>
  <Avatar v-else :class="props.class">
    <AvatarFallback class="text-sm font-medium">{{ initials }}</AvatarFallback>
  </Avatar>
</template>
