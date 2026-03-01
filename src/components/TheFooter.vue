<template>
  <footer class="shrink-0 border-t border-apc-blue/10 bg-apc-bg">
    <div
      class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row"
    >
      <div class="flex flex-wrap justify-center gap-6">
        <router-link
          to="/privacy"
          class="text-sm text-gray-600 transition-colors hover:text-apc-gold"
        >
          Privacy
        </router-link>
        <router-link
          to="/terms"
          class="text-sm text-gray-600 transition-colors hover:text-apc-gold"
        >
          Terms
        </router-link>
        <router-link
          to="/contact"
          class="text-sm text-gray-600 transition-colors hover:text-apc-gold"
        >
          Contact
        </router-link>
      </div>
      <p class="text-center text-xs text-gray-500">
        Created by
        <a
          href="https://gelolaus.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-apc-blue hover:text-apc-gold"
        >
          Angelo Laus
        </a>
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
// Minimal footer - no state needed
</script>
