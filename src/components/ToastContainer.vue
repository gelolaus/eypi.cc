<template>
  <div
    class="pointer-events-none fixed bottom-6 right-6 z-[9999] flex w-[min(100vw-2rem,20rem)] flex-col gap-3"
    :aria-live="hasError ? 'assertive' : 'polite'"
    aria-relevant="additions text"
  >
    <TransitionGroup name="toast" tag="div" class="flex flex-col gap-3">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        role="status"
        class="pointer-events-auto relative flex cursor-pointer items-center gap-3 rounded-xl border border-g-border bg-g-surface p-3 shadow-xl"
        @click="dismiss(toast.id)"
        @mouseenter="pause(toast.id)"
        @mouseleave="resume(toast.id)"
      >
        <div class="flex h-[18px] shrink-0 items-end gap-[3px]" aria-hidden="true">
          <span
            v-for="(h, i) in barHeights"
            :key="i"
            class="w-[3px]"
            :class="barClass(toast.type)"
            :style="{ height: `${h}px`, opacity: i === 3 ? 0.45 : 1 }"
          />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-snug text-g-text">
            {{ toast.message }}
          </p>
          <p
            v-if="toast.detail"
            class="mt-0.5 text-xs leading-snug text-g-muted"
          >
            {{ toast.detail }}
          </p>
        </div>

        <span
          class="shrink-0 font-mono text-[10px] font-bold tracking-[0.12em]"
          :class="tagClass(toast.type)"
        >
          {{ tagLabel(toast.type) }}
        </span>

        <button
          type="button"
          class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center text-g-muted transition-colors hover:text-g-text"
          aria-label="Dismiss"
          @click.stop="dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useToast, type ToastType } from '@/composables/useToast'

const { toasts, dismiss, pause, resume } = useToast()
const barHeights = [6, 12, 18, 10]

const hasError = computed(() => toasts.value.some((t) => t.type === 'error'))

function tagLabel(type: ToastType) {
  if (type === 'success') return 'OK'
  if (type === 'error') return 'ERR'
  return 'INFO'
}

function barClass(type: ToastType) {
  if (type === 'success') return 'bg-emerald-500'
  if (type === 'error') return 'bg-red-500'
  return 'bg-[#34418F]'
}

function tagClass(type: ToastType) {
  if (type === 'success') return 'text-emerald-600 dark:text-emerald-400'
  if (type === 'error') return 'text-red-500'
  return 'text-[#34418F] dark:text-blue-300'
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = toasts.value[toasts.value.length - 1]
  if (top) dismiss(top.id)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
