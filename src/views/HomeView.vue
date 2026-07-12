<template>
  <div class="relative flex min-h-screen min-w-0 flex-1 flex-col">
    <section
      id="hero"
      class="relative flex min-h-screen min-w-0 flex-col items-center justify-center"
    >
      <HeroSection />
    </section>

    <StatsStrip />
    <FeaturesCarousel />
    <WhyEypi />
    <ClosingCta />
  </div>
</template>

<script setup lang="ts">
import HeroSection from '@/components/HeroSection.vue'
import StatsStrip from '@/components/StatsStrip.vue'
import FeaturesCarousel from '@/components/FeaturesCarousel.vue'
import WhyEypi from '@/components/WhyEypi.vue'
import ClosingCta from '@/components/ClosingCta.vue'
import { useReveal } from '@/composables/useReveal'

useReveal()
</script>
