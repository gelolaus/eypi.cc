<template>
  <section class="relative isolate flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-20">
    <div
      aria-hidden="true"
      class="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-35"
    />
    <div class="flex max-w-md flex-col items-center gap-6 text-center">
      <div class="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Unlink
          class="size-7"
          aria-hidden="true"
        />
      </div>
      <div class="space-y-3">
        <p class="font-display text-base font-semibold text-primary">
          404
        </p>
        <h1 class="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Page not found
        </h1>
        <p class="text-base leading-relaxed text-muted-foreground">
          This link doesn't exist. It may have expired, been deleted, or been mistyped.
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
import { Unlink } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
</script>
