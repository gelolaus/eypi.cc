<template>
  <section
    class="relative w-full px-6 py-20 md:py-28"
    aria-labelledby="closing-cta-heading"
  >
    <div class="reveal mx-auto flex w-full max-w-5xl flex-col items-center text-center">
      <h2 id="closing-cta-heading" class="closing-cta-title mb-8 max-w-3xl">
        Your org's next event starts with one login.
      </h2>
      <router-link
        to="/login"
        class="tap-scale inline-flex items-center rounded-full bg-[#DEAC4B] px-10 py-4 text-base font-bold uppercase tracking-wide text-white shadow-md transition-all hover:-translate-y-0.5 hover:opacity-90"
        data-cursor="cta"
      >
        Create an account
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReveal } from '@/composables/useReveal'

useReveal()
</script>

<style scoped>
.closing-cta-title {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: clamp(1.75rem, 4.5vw, 3rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--color-text);
}
</style>
