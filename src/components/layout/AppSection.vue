<template>
  <section :aria-labelledby="title ? headingId : undefined">
    <Card class="gap-0 rounded-3xl p-6 sm:p-7">
      <component
        :is="`h${level}`"
        v-if="title"
        :id="headingId"
        class="mb-4 font-heading text-xl font-semibold tracking-tight"
      >
        {{ title }}
      </component>
      <slot />
    </Card>
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { Card } from '@/components/ui/card'

withDefaults(defineProps<{
  title?: string
  level?: 2 | 3 | 4
}>(), {
  level: 2,
})

const headingId = useId()
</script>
