<script setup lang="ts">
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from 'lucide-vue-next'
import { Toaster as Sonner } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>

<template>
  <Sonner
    theme="dark"
    class="toaster group"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    }"
    :toast-options="{ classes: { toast: 'cn-toast' } }"
  >
    <template #success-icon><CircleCheck class="size-4" /></template>
    <template #info-icon><Info class="size-4" /></template>
    <template #warning-icon><TriangleAlert class="size-4" /></template>
    <template #error-icon><OctagonX class="size-4" /></template>
    <template #loading-icon><Loader2 class="size-4 animate-spin" /></template>
  </Sonner>
</template>
