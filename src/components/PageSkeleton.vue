<template>
  <div role="status" aria-busy="true" class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
    <span class="sr-only">Loading</span>
    <div class="mb-6 space-y-3 sm:mb-8" aria-hidden="true">
      <div class="h-9 w-2/3 rounded-xl bg-g-border motion-safe:animate-pulse sm:h-10 sm:w-1/3"></div>
      <div class="h-5 w-full max-w-md rounded-xl bg-g-border motion-safe:animate-pulse"></div>
    </div>
    <div class="space-y-4" aria-hidden="true">
      <div
        v-for="n in rows"
        :key="n"
        data-skeleton-row
        class="h-28 rounded-3xl bg-g-border motion-safe:animate-pulse"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>
