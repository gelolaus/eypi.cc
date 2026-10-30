<template>
  <span
    class="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3.5 py-1.5 text-sm font-medium text-foreground"
    data-download-count
  >
    <Download
      class="size-4 text-primary"
      aria-hidden="true"
    />
    <span><strong class="font-mono text-base font-bold tabular-nums">{{ count.toLocaleString('en-US') }}</strong> {{ count === 1 ? 'download' : 'downloads' }}</span>
  </span>
</template>

<script setup lang="ts">
import { Download } from 'lucide-vue-next'

defineProps<{ count: number }>()
</script>
