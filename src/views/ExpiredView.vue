<template>
  <section
    class="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 p-6 text-center sm:p-8 dark:border-slate-600"
    >
      <PageShell />

      <h1 class="text-section-title text-[#34418F] dark:text-slate-200">
        This link has expired
      </h1>
      <p class="mt-4 text-sm leading-relaxed text-gray-500 dark:text-slate-400">
        Ask the person who shared it for a new link.
      </p>
      <router-link
        to="/"
        class="btn-primary btn-lg mt-8 w-full sm:w-auto"
      >
        Back to home
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
</script>
