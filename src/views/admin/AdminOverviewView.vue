<template>
  <section aria-labelledby="platform-heading">
    <h2
      id="platform-heading"
      class="mb-3 font-heading text-xl font-semibold tracking-tight"
    >
      Platform totals
    </h2>
    <LiveStats />
  </section>
</template>

<script setup lang="ts">
import LiveStats from '@/components/marketing/LiveStats.vue'
</script>
