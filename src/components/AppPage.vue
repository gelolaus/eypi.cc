<template>
  <div data-app-page class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
    <header class="mb-6 sm:mb-8">
      <h1 class="text-3xl font-semibold tracking-tight text-g-text sm:text-4xl">{{ title }}</h1>
      <p v-if="description || $slots.description" class="mt-2 text-base text-g-muted">
        <slot name="description">{{ description }}</slot>
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
