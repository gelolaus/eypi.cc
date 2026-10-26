<template>
  <section
    class="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-20"
  >
    <!-- Error Hardware Card -->
    <div
      class="mica-card relative flex w-full max-w-md flex-col items-center rounded-3xl border border-gray-200 p-6 text-center shadow-xl sm:p-12"
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
        class="btn-primary btn-lg w-full sm:w-auto"
      >
        Back to home
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import PageShell from '@/components/PageShell.vue'
</script>
