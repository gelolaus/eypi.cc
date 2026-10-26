<template>
  <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-600">
    <div class="flex flex-col items-center px-4 py-6">
      <p class="mb-4 text-center text-xs font-medium text-gray-500 dark:text-slate-400">
        Point the camera at an attendee's QR code to check them in.
      </p>
      <div
        v-if="scannerError"
        class="mb-4 w-full max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-500 dark:border-red-900/40 dark:bg-red-900/10"
      >
        {{ scannerError }}
      </div>
      <div class="relative w-full max-w-sm overflow-hidden rounded-xl bg-black" style="aspect-ratio: 4/3;">
        <video ref="videoRef" class="h-full w-full object-cover" muted playsinline />

        <div
          v-if="needsCameraPrompt"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6"
        >
          <p class="text-center text-xs font-medium text-white/80">
            Camera access is required to scan QR codes.
          </p>
          <button
            type="button"
            class="btn-gold rounded-xl px-6 py-3 text-sm font-semibold transition-all hover:brightness-110"
            @click="onEnableCameraClick"
          >
            {{ cameraStarting ? 'Starting…' : scanStatus === 'error' ? 'Retry camera' : 'Enable camera' }}
          </button>
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
