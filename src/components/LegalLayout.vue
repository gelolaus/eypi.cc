<template>
  <section class="relative flex min-h-dvh w-full flex-col items-center px-4 py-8 sm:justify-center sm:py-24">
    <div class="mica-card relative w-full max-w-3xl rounded-3xl border border-gray-200 p-6 dark:border-slate-600 sm:p-8 md:p-14">
      <PageShell />
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
</script>
