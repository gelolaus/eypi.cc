<template>
  <section
    class="rounded-3xl border border-g-border bg-g-surface p-6 sm:p-7"
    :aria-labelledby="title ? headingId : undefined"
  >
    <component
      :is="`h${level}`"
      v-if="title"
      :id="headingId"
      class="mb-4 text-xl font-semibold tracking-tight text-g-text"
    >
      {{ title }}
    </component>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  title?: string
  level?: 2 | 3 | 4
}>(), {
  level: 2,
})

const headingId = useId()
</script>
