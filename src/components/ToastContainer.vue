<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-[calc(8.75rem+env(safe-area-inset-bottom))] z-[9999] flex flex-col gap-3 lg:inset-x-auto lg:right-6 lg:bottom-[5.25rem] lg:w-80"
    :aria-live="hasError ? 'assertive' : 'polite'"
    aria-relevant="additions text"
  >
    <TransitionGroup name="toast" tag="div" class="flex flex-col gap-3">
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- status live region; Enter dismisses it and focus pauses the timer -->
      <div
        v-for="toast in toasts"
        :key="toast.id"
        role="status"
        tabindex="0"
        class="pointer-events-auto relative flex cursor-pointer items-center gap-3 border border-g-border bg-white py-3 pl-3 pr-1 shadow-xl dark:border-slate-600 dark:bg-mica-navy-modal dark:backdrop-blur-xl"
        @click="dismiss(toast.id)"
        @keydown.enter="dismiss(toast.id)"
        @keydown.space.prevent="dismiss(toast.id)"
        @mouseenter="pause(toast.id)"
        @focus="pause(toast.id)"
        @mouseleave="resume(toast.id)"
        @touchstart.passive="pause(toast.id)"
        @touchend="resume(toast.id)"
        @touchcancel="resume(toast.id)"
        @blur="resume(toast.id)"
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
          class="-my-2 flex size-11 shrink-0 items-center justify-center text-lg text-g-muted transition-colors hover:text-g-text"
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
  if (e.key !== 'Escape' || e.defaultPrevented) return
  if (document.querySelector('[aria-modal="true"]')) return
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
