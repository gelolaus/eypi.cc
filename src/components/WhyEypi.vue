<template>
  <section
    id="why-eypi"
    class="relative w-full px-6 py-16 md:py-24"
    aria-labelledby="why-eypi-heading"
  >
    <div class="mx-auto w-full max-w-5xl">
      <div class="reveal mb-12 text-center md:mb-16">
        <h2 id="why-eypi-heading" class="why-eypi-title">
          Why eypi.cc
        </h2>
      </div>

      <div class="grid gap-6 md:grid-cols-3 md:gap-8">
        <article
          v-for="(pillar, index) in pillars"
          :key="pillar.title"
          :class="['reveal mica-card rounded-3xl border border-g-border p-8', `delay-${Math.min(index + 1, 4)}`]"
        >
          <h3 class="text-card-title mb-3">{{ pillar.title }}</h3>
          <p class="text-base leading-relaxed text-g-muted">
            {{ pillar.body }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useReveal } from '@/composables/useReveal'

useReveal()

const pillars = [
  {
    title: 'Free, no catch',
    body: 'Built and run by one APC student developer. No ads, no premium tier, no funding round to please.',
  },
  {
    title: 'One login, every tool',
    body: 'Your APC account and org membership carry across Links, Forms, Tix, Frames, and Orgs. No separate signups.',
  },
  {
    title: "Shaped like APC's paperwork",
    body: 'Concessionaire contracts, visitor passes, and letters of intent match the formats APC already asks for.',
  },
]
</script>

<style scoped>
.why-eypi-title {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--color-text);
}
</style>
