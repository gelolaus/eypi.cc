<template>
  <div
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    role="presentation"
    @mousedown.self="$emit('backdrop')"
  >
    <div
      ref="panelRef"
      :class="cn(
        'w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-8 text-left shadow-2xl',
        className,
      )"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledBy"
      :aria-describedby="describedBy"
      tabindex="-1"
      @keydown="$emit('keydown', $event)"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/lib/cn'

defineProps<{
  labelledBy?: string
  describedBy?: string
  className?: string
}>()

defineEmits<{
  backdrop: []
  keydown: [event: KeyboardEvent]
}>()

const panelRef = ref<HTMLElement | null>(null)

defineExpose({ panelRef })
</script>
