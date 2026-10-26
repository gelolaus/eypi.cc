<template>
  <div class="relative flex min-w-0 flex-1 flex-col">
    <Hero />
    <FeatureStrip />
    <ProofSection />
    <CtaSection />
  </div>
</template>

<script setup lang="ts">
import CtaSection from '@/components/marketing/CtaSection.vue'
import FeatureStrip from '@/components/marketing/FeatureStrip.vue'
import Hero from '@/components/marketing/Hero.vue'
import ProofSection from '@/components/marketing/ProofSection.vue'
</script>
