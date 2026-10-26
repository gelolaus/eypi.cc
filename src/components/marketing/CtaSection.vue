<template>
  <section
    class="mx-auto max-w-3xl px-5 pb-28 text-center sm:px-6"
    aria-labelledby="cta-heading"
  >
    <h2
      id="cta-heading"
      class="text-3xl font-semibold tracking-tight sm:text-4xl"
    >
      Your org's next event starts with one login.
    </h2>
    <Button
      as-child
      size="lg"
      class="mt-8 h-14 px-6 text-base"
    >
      <router-link to="/login">
        Create an account
      </router-link>
    </Button>
  </section>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>
