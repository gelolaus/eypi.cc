<template>
  <div class="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
    <TransitionGroup name="toast" tag="div" class="flex flex-col gap-3">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="w-80 bg-white border border-gray-200 shadow-xl flex items-center p-4 relative overflow-hidden pointer-events-auto dark:bg-mica-navy-modal dark:border-slate-600 dark:backdrop-blur-xl"
      >
        <div
          class="absolute left-0 top-0 bottom-0 w-1"
          :class="{
            'bg-emerald-500': toast.type === 'success',
            'bg-red-500': toast.type === 'error',
            'bg-[#34418F]': toast.type === 'info'
          }"
        />
        <p class="font-mono text-sm font-bold ml-2 uppercase tracking-wide text-gray-800 dark:text-slate-200">
          {{ toast.message }}
        </p>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
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
</style>
