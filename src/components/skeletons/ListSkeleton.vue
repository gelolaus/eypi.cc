<template>
  <div
    role="status"
    aria-busy="true"
    class="flex flex-col gap-3"
  >
    <span class="sr-only">{{ label }}</span>
    <Skeleton
      v-for="n in rows"
      :key="n"
      data-skeleton-row
      :h="rowHeight"
      :radius="radius"
    />
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'

withDefaults(defineProps<{ rows?: number; rowHeight?: number; radius?: number; label?: string }>(), {
  rows: 3,
  rowHeight: 112,
  radius: 12,
  label: 'Loading',
})
</script>
