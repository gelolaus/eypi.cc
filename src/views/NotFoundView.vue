<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center px-6 py-20"
  >
    <!-- Error Hardware Card -->
    <div
      class="mica-card relative flex w-full max-w-md flex-col items-center rounded-3xl border border-gray-200 p-8 text-center shadow-xl sm:p-12"
    >
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <!-- Error Code -->
      <h1
        class="text-data mb-2 text-7xl font-black leading-none text-[#34418F] sm:text-8xl md:text-9xl"
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
        class="rounded-xl bg-[#DEAC4B] px-6 py-3 font-mono font-semibold text-white shadow-md transition-all hover:scale-105 sm:px-8 sm:py-4"
      >
        Back to home
      </router-link>
    </div>
  </section>
</template>
