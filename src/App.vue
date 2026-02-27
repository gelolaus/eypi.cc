<template>
  <div class="flex h-screen flex-col overflow-hidden bg-dot-grid">
    <TheHeader />
    <main class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <HeroSection />
    </main>
    <TheFooter />
  </div>
</template>

<script setup lang="ts">
import TheHeader from '@/components/TheHeader.vue'
import HeroSection from '@/components/HeroSection.vue'
import TheFooter from '@/components/TheFooter.vue'
</script>
