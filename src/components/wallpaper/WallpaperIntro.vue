<template>
  <Dialog
    :open="open"
    @update:open="(value) => !value && close(false)"
  >
    <DialogContent class="max-h-[calc(100svh-2rem)] gap-3 overflow-y-auto sm:max-w-3xl">
      <DialogHeader class="pr-8">
        <DialogTitle>Welcome to Eypi Wallpaper</DialogTitle>
        <DialogDescription>
          Paste your RAMS schedule and get a lock screen wallpaper. Here is how it works in 30 seconds.
        </DialogDescription>
      </DialogHeader>
      <video
        class="aspect-video max-h-[55svh] w-full rounded-lg bg-black object-contain"
        :src="VIDEO_SRC"
        :poster="VIDEO_POSTER"
        controls
        playsinline
        muted
        :autoplay="!prefersReducedMotion"
        preload="metadata"
      />
      <label class="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          class="size-4 cursor-pointer accent-primary"
          @change="close(true)"
        >
        Close this and never show it again
      </label>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWallpaperIntro } from '@/composables/useWallpaperIntro'

// Served from public/, so these paths must stay out of the template (the build would try to bundle them).
const VIDEO_SRC = '/wallpaper-intro.mp4'
const VIDEO_POSTER = '/wallpaper-intro-poster.jpg'

const { open, close } = useWallpaperIntro()

// With reduced motion on, the video waits for a tap instead of starting by itself.
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
</script>
