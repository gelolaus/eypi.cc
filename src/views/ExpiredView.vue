<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 p-8 text-center dark:border-slate-600"
    >
      <div
        class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />
      <div
        class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />
      <div
        class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />
      <div
        class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />

      <h1 class="text-section-title text-[#34418F] dark:text-slate-200">
        This link has expired
      </h1>
      <p class="mt-4 text-sm leading-relaxed text-gray-500 dark:text-slate-400">
        Ask the person who shared it for a new link.
      </p>
      <router-link
        to="/"
        class="mt-8 inline-block rounded-xl bg-[#DEAC4B] px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
      >
        Back to home
      </router-link>
    </div>
  </section>
</template>
