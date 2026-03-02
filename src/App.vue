<template>
  <div class="flex min-h-screen flex-col">
    <!-- Base layer: grid + coordinates (behind everything) -->
    <div
      id="base-layer"
      class="fixed inset-0 pointer-events-none bg-dot-grid"
      style="z-index: -10;"
    >
      <!-- Corner registration marks -->
      <div class="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-gray-300 dark:border-slate-600" />
      <div class="absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-gray-300 dark:border-slate-600" />
      <div class="absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-gray-300 dark:border-slate-600" />
      <div class="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-gray-300 dark:border-slate-600" />
      <!-- Pasay coordinates (hidden on mobile to avoid bleed-through) -->
      <div
        class="absolute left-2 top-1/2 hidden -translate-y-1/2 -rotate-90 font-mono text-xs text-gray-400 md:block dark:text-slate-500"
      >
        COORD. 14.531105 N // 121.021309 E
      </div>
    </div>

    <TheHeader />
    <main id="app-content" class="relative z-10 flex min-h-0 flex-1 flex-col">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>
    <TheFooter />
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import TheHeader from '@/components/TheHeader.vue'
import TheFooter from '@/components/TheFooter.vue'
import ToastContainer from '@/components/ToastContainer.vue'
</script>

