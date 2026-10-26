<template>
  <section class="relative isolate flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-24">
    <div
      aria-hidden="true"
      class="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-35"
    />
    <div class="flex max-w-md flex-col items-center gap-6 text-center">
      <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Clock
          class="size-7"
          aria-hidden="true"
        />
      </div>
      <div class="space-y-3">
        <h1 class="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          This link has expired
        </h1>
        <p class="text-base leading-relaxed text-muted-foreground">
          Ask the person who shared it for a new link.
        </p>
      </div>
      <Button
        as-child
        size="lg"
      >
        <router-link to="/">
          Back to home
        </router-link>
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
</script>
