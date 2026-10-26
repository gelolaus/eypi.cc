<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <div class="mica-card relative w-full max-w-3xl rounded-3xl border border-gray-200 p-8 dark:border-slate-600 md:p-14">
      <PageShell />
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
</script>
