<template>
  <div
    role="status"
    aria-busy="true"
    class="space-y-4"
  >
    <span class="sr-only">{{ label }}</span>
    <Skeleton
      data-skeleton-block
      :w="titleWidth"
      :h="titleHeight"
    />
    <Skeleton
      data-skeleton-block
      :h="bodyHeight"
      :radius="24"
    />
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'

withDefaults(defineProps<{ titleHeight?: number; titleWidth?: string; bodyHeight?: number; label?: string }>(), {
  titleHeight: 40,
  titleWidth: '50%',
  bodyHeight: 256,
  label: 'Loading',
})
</script>
