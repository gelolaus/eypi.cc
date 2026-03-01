<template>
  <footer class="shrink-0 border-t border-apc-blue/10 bg-apc-bg dark:border-slate-800 dark:bg-slate-950/80">
    <div
      class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row"
    >
      <div class="flex flex-wrap justify-center gap-6">
        <router-link
          to="/privacy"
          class="text-sm text-gray-600 transition-colors hover:text-apc-gold dark:text-slate-400 dark:hover:text-slate-200"
        >
          Privacy
        </router-link>
        <router-link
          to="/terms"
          class="text-sm text-gray-600 transition-colors hover:text-apc-gold dark:text-slate-400 dark:hover:text-slate-200"
        >
          Terms
        </router-link>
        <router-link
          to="/contact"
          class="text-sm text-gray-600 transition-colors hover:text-apc-gold dark:text-slate-400 dark:hover:text-slate-200"
        >
          Contact
        </router-link>
      </div>
      <p class="text-center text-xs text-gray-500 dark:text-slate-500">
        Created by
        <a
          href="https://gelolaus.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-apc-blue hover:text-apc-gold dark:text-slate-300 dark:hover:text-slate-100"
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
