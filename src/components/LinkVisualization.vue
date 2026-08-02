<template>
  <div class="relative flex items-center justify-center p-8">
    <div class="w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-10 shadow-sm">
      <p class="text-center font-mono text-base font-semibold text-g-primary sm:text-lg">
        eypi.cc/{{ slug || 'your-slug' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  slug?: string
}>()
</script>
