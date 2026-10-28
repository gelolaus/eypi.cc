<template>
  <section class="relative isolate overflow-hidden px-5 pb-24 pt-12 sm:px-6 sm:pt-20">
    <div
      class="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-40"
      aria-hidden="true"
    />
    <div
      class="float-slow pointer-events-none absolute -left-12 -top-6 -z-10 size-40 sm:-left-10 sm:top-24 rounded-3xl bg-primary/15"
      aria-hidden="true"
    />
    <div
      class="float-slow pointer-events-none absolute -right-8 bottom-16 -z-10 size-28 rounded-full bg-accent"
      aria-hidden="true"
    />

    <div class="mx-auto grid max-w-5xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
      <div class="text-center lg:text-left">
        <BrandLogo
          size="lg"
          class="justify-center lg:justify-start"
        />
        <h1 class="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
          The toolkit for <span class="text-primary">APC</span> orgs.
        </h1>
        <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:mx-0">
          Short links, official paperwork, event tickets, and org pages. One APC login, zero ads.
        </p>
        <div class="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
          <Button
            as-child
            size="lg"
            class="h-14 px-6 text-base"
          >
            <router-link to="/login">
              Get started
            </router-link>
          </Button>
          <a
            href="#features"
            class="inline-flex min-h-11 items-center px-2 text-base font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            @click.prevent="scrollToFeatures"
          >
            See what's inside
          </a>
        </div>
      </div>

      <div
        data-hero-panel
        class="mx-auto w-full max-w-md justify-self-center lg:justify-self-end"
      >
        <LiveStats />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: 'MarketingHero' })
import BrandLogo from '@/components/brand/BrandLogo.vue'
import LiveStats from '@/components/marketing/LiveStats.vue'
import { Button } from '@/components/ui/button'

function scrollToFeatures() {
  const target = document.getElementById('features')
  if (!target) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}
</script>
