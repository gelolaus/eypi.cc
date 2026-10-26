<template>
  <div
    data-app-page
    class="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
  >
    <header class="space-y-1.5">
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
        {{ title }}
      </h1>
      <p
        v-if="description || $slots.description"
        class="max-w-2xl text-base text-muted-foreground sm:text-lg"
      >
        <slot name="description">
          {{ description }}
        </slot>
      </p>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>
