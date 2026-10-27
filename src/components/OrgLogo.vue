<template>
  <div
    class="shrink-0 overflow-hidden rounded-lg border border-border bg-card"
    :class="sizeClass"
    :title="name"
  >
    <AppImage
      v-if="logoUrl"
      :src="logoUrl"
      :meta="logoMeta"
      :sizes="imageSizes"
      :alt="name ? `${name} logo` : 'Organization logo'"
      class="h-full w-full object-cover"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-primary/10 font-mono font-bold text-primary"
      :class="initialsClass"
    >
      {{ orgInitials(name) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppImage from '@/components/AppImage.vue'
import type { ImageMeta } from '@/lib/images/variants'
import { orgInitials } from '@/types/orgs'

const props = withDefaults(
  defineProps<{
    logoUrl?: string | null
    logoMeta?: ImageMeta | null
    name?: string
    size?: 'xs' | 'sm' | 'md'
  }>(),
  {
    logoUrl: null,
    logoMeta: null,
    name: '',
    size: 'sm',
  },
)

const sizeClass = computed(() => {
  if (props.size === 'xs') return 'h-5 w-5 rounded-md'
  if (props.size === 'md') return 'h-10 w-10 rounded-xl'
  return 'h-7 w-7 rounded-lg'
})

const imageSizes = computed(() => (props.size === 'xs' ? '20px' : props.size === 'md' ? '40px' : '28px'))

const initialsClass = computed(() => {
  if (props.size === 'xs') return 'text-[7px]'
  if (props.size === 'md') return 'text-xs'
  return 'text-[9px]'
})
</script>
