<template>
  <div
    role="status"
    aria-busy="true"
    class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    <span class="sr-only">{{ label }}</span>
    <Skeleton
      v-for="n in count"
      :key="n"
      data-skeleton-card
      :h="cardHeight"
      :radius="24"
    />
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'

withDefaults(defineProps<{ count?: number; cardHeight?: number; label?: string }>(), {
  count: 6,
  cardHeight: 192,
  label: 'Loading',
})
</script>
