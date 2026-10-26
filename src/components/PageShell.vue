<template>
  <div class="contents">
    <div
      class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
      :class="screwClass"
      aria-hidden="true"
    />
    <div
      class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
      :class="screwClass"
      aria-hidden="true"
    />
    <div
      class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
      :class="screwClass"
      aria-hidden="true"
    />
    <div
      class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
      :class="screwClass"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  screwClass?: string
}>()
</script>
