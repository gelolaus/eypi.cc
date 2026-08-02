<template>
  <section class="mx-auto max-w-3xl px-5 pb-24 text-center sm:px-6 sm:pb-28">
    <h2 class="font-display text-3xl font-semibold tracking-tight text-g-text sm:text-4xl">
      Start with an APC email.
    </h2>
    <p class="mx-auto mt-4 max-w-md text-base text-g-muted sm:text-lg">
      Sign in, create a short link, and share it with a QR or URL.
    </p>
    <router-link
      to="/login"
      :class="buttonVariants({ variant: 'primary', size: 'lg', className: 'mt-8 h-14 px-6 text-base' })"
    >
      Get started
      <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </router-link>
  </section>
</template>

<script setup lang="ts">
import { buttonVariants } from '@/lib/ui/buttonVariants'
</script>
