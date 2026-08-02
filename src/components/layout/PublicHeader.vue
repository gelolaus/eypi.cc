<template>
  <header
    class="sticky top-0 z-40 border-b border-g-border/70 bg-g-bg/90 backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
      <router-link
        to="/"
        class="font-display text-lg font-bold tracking-tight text-g-text"
      >
        eypi.cc
      </router-link>
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup lang="ts">
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
</script>
