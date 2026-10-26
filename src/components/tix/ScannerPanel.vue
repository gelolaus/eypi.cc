<template>
  <Card class="-mx-4 gap-0 overflow-hidden rounded-none p-0 sm:mx-0 sm:rounded-2xl">
    <p class="bg-card px-4 py-3 text-center text-sm font-medium text-muted-foreground">
      Point the camera at an attendee's QR code to check them in.
    </p>
    <div
      v-if="scannerError"
      role="alert"
      class="border-y border-destructive/30 bg-destructive/10 px-4 py-3 font-mono text-sm text-destructive"
    >
      {{ scannerError }}
    </div>
    <div
      data-scanner-viewport
      class="relative w-full bg-black"
      style="aspect-ratio: 3/4; max-height: 70dvh;"
    >
      <video
        ref="videoRef"
        class="h-full w-full object-cover"
        muted
        playsinline
      />

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
        class="pointer-events-none absolute inset-x-3 top-3 rounded-lg px-3 py-2 font-mono text-xs font-semibold text-white"
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
    <div
      data-scanner-actions
      class="sticky bottom-0 z-10 flex items-center justify-center gap-3 bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <Button
        v-if="needsCameraPrompt"
        type="button"
        size="lg"
        class="w-full"
        @click="onEnableCameraClick"
      >
        {{ cameraStarting ? 'Starting…' : scanStatus === 'error' ? 'Retry camera' : 'Enable camera' }}
      </Button>
      <p
        v-else
        class="flex min-h-11 items-center text-sm text-muted-foreground"
      >
        Scanning for QR codes
      </p>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
