<template>
  <header
    class="sticky top-0 z-50 shrink-0 w-full border-b border-apc-blue/10 bg-[#f5f5f4]/80 backdrop-blur-md"
  >
    <nav
      class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      aria-label="Main navigation"
    >
      <router-link
        to="/"
        class="font-mono text-lg font-semibold text-apc-blue transition-colors hover:text-apc-gold"
      >
        eypi.cc
      </router-link>
      <div class="flex items-center">
        <router-link
          to="/login"
          class="rounded-lg bg-apc-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 hover:shadow-md"
        >
          Login
        </router-link>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
// Minimal header - no state needed
</script>
