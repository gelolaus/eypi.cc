<template>
  <section class="relative px-5 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_70%)]"
      aria-hidden="true"
    />

    <div
      class="mx-auto grid max-w-5xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12"
    >
      <div class="text-center lg:text-left">
        <p class="font-display text-2xl font-bold tracking-tight text-g-brand sm:text-3xl">
          eypi.cc
        </p>

        <h1
          class="mt-6 font-display text-4xl font-semibold tracking-tight text-g-text sm:text-5xl"
        >
          Short links for APC orgs.
        </h1>

        <p
          class="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-g-muted sm:text-xl lg:mx-0"
        >
          Branded short links with QR codes and click counts, plus forms, tickets, frames, and org pages under one APC login.
        </p>

        <div
          class="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
        >
          <router-link
            to="/login"
            :class="buttonVariants({ variant: 'primary', size: 'lg', className: 'h-14 px-6 text-base' })"
          >
            Get started
            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </router-link>

          <router-link
            :to="continueTo"
            class="text-base font-medium text-g-muted underline-offset-4 transition-colors hover:text-g-text hover:underline"
          >
            Continue
          </router-link>
        </div>
      </div>

      <div class="mx-auto justify-self-center lg:justify-self-end">
        <ProductMockup />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ProductMockup from '@/components/marketing/ProductMockup.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'
import { useAuth } from '@/composables/useAuth'

const { getUser } = useAuth()

const continueTo = computed(() => (getUser() ? '/dashboard' : '/login'))
</script>
