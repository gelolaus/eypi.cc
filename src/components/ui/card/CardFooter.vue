<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/cn'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    data-slot="card-footer"
    :class="
      cn(
        'flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
