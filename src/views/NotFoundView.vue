<template>
  <section
    class="relative flex min-h-0 flex-1 w-full flex-col items-center justify-center overflow-hidden px-4"
  >
    <!-- Corner registration marks -->
    <div
      class="pointer-events-none absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-gray-300"
    />
    <div
      class="pointer-events-none absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-gray-300"
    />
    <div
      class="pointer-events-none absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-gray-300"
    />
    <div
      class="pointer-events-none absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-gray-300"
    />

    <!-- Pasay coordinates - left edge -->
    <div
      class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-xs text-gray-400"
    >
      COORD. 14.531105 N // 121.021309 E
    </div>

    <!-- Error Hardware Card -->
    <div
      class="mica-card relative flex w-full max-w-lg flex-col items-center rounded-3xl border border-gray-200 p-12 text-center shadow-xl"
    >
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <!-- Error Code -->
      <h1
        class="mb-2 font-mono text-8xl font-black leading-none tracking-tighter text-[#34418F] md:text-9xl"
      >
        404
      </h1>

      <!-- Subtitle -->
      <h2
        class="mb-6 font-mono text-lg font-bold uppercase tracking-widest text-[#DEAC4B] md:text-xl"
      >
        Transmission Failed
      </h2>

      <!-- Body -->
      <p
        class="mb-10 font-mono text-sm leading-relaxed text-gray-500 md:text-base"
      >
        The requested destination could not be located in the registry. The
        link may have expired, been deleted, or never existed.
      </p>

      <!-- CTA -->
      <router-link
        to="/"
        class="rounded-xl bg-[#DEAC4B] px-8 py-4 font-mono font-bold uppercase tracking-wider text-white shadow-md transition-all hover:scale-105"
      >
        Return to System
      </router-link>
    </div>
  </section>
</template>
