<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 p-8 text-center dark:border-slate-600"
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
 class="btn-gold mt-8 inline-block rounded-xl px-6 py-3 text-sm font-semibold transition-all hover:brightness-110"
      >
        Back to home
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
</script>
