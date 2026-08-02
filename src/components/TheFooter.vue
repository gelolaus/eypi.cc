<template>
  <footer class="border-t border-g-border">
    <div
      class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-12 text-sm text-g-muted sm:px-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>© {{ currentYear }} eypi.cc</p>
      <nav class="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Footer">
        <router-link to="/contact" class="transition-colors hover:text-g-text">
          Contact
        </router-link>
        <router-link to="/privacy" class="transition-colors hover:text-g-text">
          Privacy
        </router-link>
        <router-link to="/terms" class="transition-colors hover:text-g-text">
          Terms
        </router-link>
      </nav>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>
