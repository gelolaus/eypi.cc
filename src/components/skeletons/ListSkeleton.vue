<template>
  <div
    role="status"
    aria-busy="true"
  >
    <span class="sr-only">{{ label }}</span>
    <div
      class="flex flex-col gap-3"
      :class="mdRowHeight ? 'md:hidden' : ''"
    >
      <Skeleton
        v-for="n in rows"
        :key="n"
        data-skeleton-row
        :h="rowHeight"
        :radius="radius"
      />
    </div>
    <div
      v-if="mdRowHeight"
      class="hidden flex-col gap-3 md:flex"
    >
      <Skeleton
        v-for="n in rows"
        :key="n"
        data-skeleton-row-md
        :h="mdRowHeight"
        :radius="radius"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from '@/components/ui/Skeleton.vue'

withDefaults(defineProps<{ rows?: number; rowHeight?: number; mdRowHeight?: number; radius?: number; label?: string }>(), {
  rows: 3,
  rowHeight: 112,
  mdRowHeight: undefined,
  radius: 12,
  label: 'Loading',
})
</script>
