<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center px-6 py-20"
  >
    <!-- Error Hardware Card -->
    <div
      class="mica-card relative flex w-full max-w-md flex-col items-center rounded-3xl border border-gray-200 p-8 text-center shadow-xl sm:p-12"
    >
      <PageShell />

      <!-- Error Code -->
      <h1
        class="text-data mb-2 text-7xl font-black leading-none text-g-primary sm:text-8xl md:text-9xl"
      >
        404
      </h1>

      <!-- Subtitle -->
      <h2
        class="mb-4 text-lg font-semibold text-[#DEAC4B] sm:mb-6 sm:text-lg md:text-xl"
      >
        Page not found
      </h2>

      <!-- Body -->
      <p
        class="mb-8 text-sm leading-relaxed text-gray-500 sm:mb-10 md:text-base"
      >
        This link doesn't exist. It may have expired, been deleted, or been mistyped.
      </p>

      <!-- CTA -->
      <router-link
        to="/"
 class="btn-gold rounded-xl px-6 py-3 font-mono font-semibold shadow-md transition-all hover:scale-105 sm:px-8 sm:py-4"
      >
        Back to home
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
</script>
