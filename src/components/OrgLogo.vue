<template>
  <div
    class="org-logo shrink-0 overflow-hidden rounded-lg border border-g-border bg-g-surface"
    :class="sizeClass"
    :title="name"
  >
    <img
      v-if="logoUrl"
      :src="logoUrl"
      :alt="name ? `${name} logo` : 'Organization logo'"
      class="h-full w-full object-cover"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-[#34418F]/10 font-mono font-bold text-[#34418F] dark:text-[#DEAC4B]"
      :class="initialsClass"
    >
      {{ orgInitials(name) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { orgInitials } from '@/types/orgs'

const props = withDefaults(
  defineProps<{
    logoUrl?: string | null
    name?: string
    size?: 'xs' | 'sm' | 'md'
  }>(),
  {
    logoUrl: null,
    name: '',
    size: 'sm',
  },
)

const sizeClass = computed(() => {
  if (props.size === 'xs') return 'h-5 w-5 rounded-md'
  if (props.size === 'md') return 'h-10 w-10 rounded-xl'
  return 'h-7 w-7 rounded-lg'
})

const initialsClass = computed(() => {
  if (props.size === 'xs') return 'text-[7px]'
  if (props.size === 'md') return 'text-xs'
  return 'text-[9px]'
})
</script>
