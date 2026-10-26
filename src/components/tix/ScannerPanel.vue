<template>
  <div class="-mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-2xl">
    <p class="bg-g-surface px-4 py-3 text-center text-sm font-medium text-g-muted">
      Point the camera at an attendee's QR code to check them in.
    </p>
    <div
      v-if="scannerError"
      role="alert"
      class="border-y border-red-200 bg-red-50 px-4 py-3 font-mono text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400"
    >
      {{ scannerError }}
    </div>
    <div data-scanner-viewport class="relative w-full bg-black" style="aspect-ratio: 3/4; max-height: 70dvh;">
      <video ref="videoRef" class="h-full w-full object-cover" muted playsinline />

      <div
        v-if="needsCameraPrompt"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6"
      >
        <p class="text-center text-sm font-medium text-white/90">
          Camera access is required to scan QR codes.
        </p>
      </div>

      <div class="pointer-events-none absolute inset-0">
        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/90"
          style="width: 72%; aspect-ratio: 1; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);"
        />
      </div>

      <div
        :class="hudClass"
        class="pointer-events-none absolute inset-x-3 top-3 rounded-lg px-3 py-2 text-data text-xs font-semibold text-white"
      >
        {{ hudLabel }}
      </div>

      <div
        v-if="scanMessage"
        :class="hudBannerClass"
        class="pointer-events-none absolute inset-x-0 bottom-0 px-4 py-3 text-sm font-semibold text-white"
      >
        {{ scanMessage }}
      </div>
    </div>
    <div data-scanner-actions class="sticky bottom-0 z-10 flex items-center justify-center gap-3 bg-g-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        v-if="needsCameraPrompt"
        type="button"
        class="btn-gold min-h-11 w-full rounded-xl px-6 text-base font-semibold transition-all hover:brightness-110"
        @click="onEnableCameraClick"
      >
        {{ cameraStarting ? 'Starting…' : scanStatus === 'error' ? 'Retry camera' : 'Enable camera' }}
      </button>
      <p v-else class="min-h-11 flex items-center text-sm text-g-muted">Scanning for QR codes</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useQrScanner } from '@/composables/useQrScanner'

const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ checkedIn: [] }>()

const {
  videoRef,
  scannerError,
  scanStatus,
  scanMessage,
  cameraStarting,
  needsCameraPrompt,
  hudLabel,
  hudClass,
  hudBannerClass,
  onEnableCameraClick,
  stopScanner,
} = useQrScanner({
  slug: props.slug,
  onCheckedIn: () => emit('checkedIn'),
})

onUnmounted(() => stopScanner())
</script>
