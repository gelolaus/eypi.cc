<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center px-6 py-20"
  >
    <Card className="relative flex w-full max-w-md flex-col items-center text-center">
      <h1 class="font-display text-7xl font-bold leading-none tracking-tight text-g-brand sm:text-8xl">
        404
      </h1>

      <h2 class="mt-4 font-display text-lg font-semibold text-g-primary sm:text-xl">
        Page not found
      </h2>

      <p class="mb-8 mt-4 text-sm leading-relaxed text-g-muted sm:mb-10 md:text-base">
        This link doesn't exist. It may have expired, been deleted, or been mistyped.
      </p>

      <router-link
        to="/"
        :class="buttonVariants({ variant: 'primary', size: 'lg' })"
      >
        Back to home
      </router-link>
    </Card>
  </section>
</template>

<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'
</script>
